'use server';

import { createServiceClient } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  deleteMetaObject,
} from '@/lib/meta-api';
import { calculateHealthChecks } from '@/lib/healthgate';

interface Angle {
  headline: string;
  primary_text: string;
  cta: string;
}

interface CreateTestInput {
  idea: string;
  audience: string;
  offer: string;
  angle: Angle;
  orgId?: string;
  adAccountId?: string;
  budgetCents?: number;
  vertical?: string;
}

interface CreateTestResult {
  success: boolean;
  testId?: string;
  error?: string;
}

export async function createTest(input: CreateTestInput): Promise<CreateTestResult> {
  const {
    idea,
    audience,
    offer,
    angle,
    orgId,
    adAccountId,
    budgetCents = 50000,
    vertical = 'saas',
  } = input;

  if (!orgId || !adAccountId) {
    return { success: false, error: 'Missing required account information. Connect an ad account first.' };
  }

  // ── 0. Server-side Healthgate check ──────────────────────────────────
  const { data: latestSnapshot } = await supabaseAdmin
    .from('health_snapshots')
    .select('payload')
    .eq('ad_account_id', adAccountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latestSnapshot?.payload) {
    const health = calculateHealthChecks(latestSnapshot.payload);
    if (health.status === 'red') {
      return {
        success: false,
        error: `Healthgate blocked: score ${health.score}/100. Fix account issues before launching.`,
      };
    }
  }

  // ── Resolve access token ─────────────────────────────────────────────
  const { data: account } = await supabaseAdmin
    .from('ad_accounts')
    .select('access_token')
    .eq('id', adAccountId)
    .single();

  let accessToken = account?.access_token;
  if (!accessToken || !String(accessToken).startsWith('EAA')) {
    accessToken = process.env.AD_ACCESS_TOKEN;
  }
  if (!accessToken) {
    return { success: false, error: 'No access token available for this ad account.' };
  }

  const supabase = createServiceClient();
  const createdObjects: { type: string; id: string }[] = [];
  let lpUrl: string | null = null;
  let testId: string | null = null;

  try {
    // ── 1. Insert test row (draft) ─────────────────────────────────────
    const shareToken = crypto.randomUUID().slice(0, 8);
    const { data: testData, error: insertError } = await supabase
      .from('tests')
      .insert({
        org_id: orgId,
        ad_account_id: adAccountId,
        name: idea.slice(0, 120),
        status: 'draft',
        budget_cents: budgetCents,
        vertical,
        idea,
        audience,
        offer,
        angles: [angle],
        share_token: shareToken,
      })
      .select('id')
      .single();

    if (insertError || !testData) {
      throw new Error(`DB insert failed: ${insertError?.message || 'unknown'}`);
    }
    testId = testData.id;

    // ── 2. Deploy landing page BEFORE campaign ─────────────────────────
    const lpHtml = generateSimpleLPHtml(idea, angle, offer);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://launchlense.app';

    const lpRes = await fetch(`${appUrl}/api/lp/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test_id: testId,
        html: lpHtml,
      }),
    });

    if (!lpRes.ok) {
      const lpErr = await lpRes.json().catch(() => ({}));
      throw new Error(`LP deploy failed: ${lpErr.error || lpRes.statusText}`);
    }

    const lpData = await lpRes.json();
    lpUrl = lpData.url;

    if (!lpUrl) {
      throw new Error('LP deploy returned no URL');
    }

    // ── 3. Create campaign ─────────────────────────────────────────────
    const campaignResult = await createCampaign(adAccountId, accessToken, {
      name: `[LaunchLense] ${idea.slice(0, 60)}`,
      objective: 'OUTCOME_LEADS',
      status: 'PAUSED',
      special_ad_categories: [],
    });
    const campaignId = (campaignResult as { id: string }).id;
    createdObjects.push({ type: 'campaign', id: campaignId });

    // ── 4. Create ad set ───────────────────────────────────────────────
    const adSetResult = await createAdSet(adAccountId, accessToken, {
      campaign_id: campaignId,
      name: `${angle.headline.slice(0, 40)} - Broad US`,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LEAD_GENERATION',
      daily_budget: Math.floor(budgetCents / 2),
      targeting: {
        geo_locations: { countries: ['US'] },
        age_min: 25,
        age_max: 65,
        publisher_platforms: ['facebook', 'instagram'],
        facebook_positions: ['feed'],
        instagram_positions: ['stream'],
      },
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      status: 'PAUSED',
    });
    const adSetId = (adSetResult as { id: string }).id;
    createdObjects.push({ type: 'adset', id: adSetId });

    // ── 5. Create ad creative (with real LP URL) ───────────────────────
    const creativeResult = await createAdCreative(adAccountId, accessToken, {
      name: `Creative - ${angle.headline.slice(0, 40)}`,
      object_story_spec: {
        page_id: process.env.META_PAGE_ID,
        link_data: {
          message: angle.primary_text,
          name: angle.headline,
          call_to_action: { type: angle.cta || 'LEARN_MORE' },
          link: lpUrl,
        },
      },
    });
    const creativeId = (creativeResult as { id: string }).id;
    createdObjects.push({ type: 'creative', id: creativeId });

    // ── 6. Create ad ───────────────────────────────────────────────────
    const adResult = await createAd(adAccountId, accessToken, {
      name: `Ad - ${angle.headline.slice(0, 40)}`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED',
    });
    const adId = (adResult as { id: string }).id;
    createdObjects.push({ type: 'ad', id: adId });

    // ── 7. Update test row: draft → active with Meta IDs ──────────────
    await supabase
      .from('tests')
      .update({
        status: 'active',
        campaign_id: campaignId,
        adset_id: adSetId,
        ad_id: adId,
        creative_id: creativeId,
        lp_url: lpUrl,
      })
      .eq('id', testId);

    // ── 8. Activate the campaign ───────────────────────────────────────
    const { updateCampaignStatus } = await import('@/lib/meta-api');
    await updateCampaignStatus(campaignId, accessToken, 'ACTIVE');

    // ── 9. Insert launch annotation ────────────────────────────────────
    await supabase.from('annotations').insert({
      test_id: testId,
      author: 'system',
      message: `Campaign launched. LP: ${lpUrl} | Budget: $${(budgetCents / 100).toFixed(0)} | Angle: "${angle.headline}"`,
    });

    return { success: true, testId: testId! };
  } catch (error) {
    // Rollback: delete created Meta objects in reverse order
    console.error('[createTest] Error, rolling back:', error);
    for (const obj of createdObjects.reverse()) {
      try {
        await deleteMetaObject(obj.id, accessToken);
        console.log(`[rollback] Deleted ${obj.type} ${obj.id}`);
      } catch (rollbackErr) {
        console.error(`[rollback] Failed to delete ${obj.type} ${obj.id}:`, rollbackErr);
      }
    }

    // Mark test as failed if it was created
    if (testId) {
      await supabase
        .from('tests')
        .update({ status: 'failed' })
        .eq('id', testId);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Campaign creation failed',
    };
  }
}

/**
 * Generate a simple LP HTML body from the test angle.
 * The /api/lp/deploy route wraps this in a full page template.
 */
function generateSimpleLPHtml(idea: string, angle: Angle, offer: string): string {
  return `
    <h1>${escapeHtml(angle.headline)}</h1>
    <p style="font-size:1.25rem;color:#FAFAFA;margin-bottom:1.5rem;">
      ${escapeHtml(angle.primary_text)}
    </p>
    <p>${escapeHtml(offer)}</p>
    <div style="margin-top:2rem;">
      <a href="#signup" class="lp-cta">${escapeHtml(angle.cta || 'Learn More')}</a>
    </div>
    <p style="margin-top:3rem;font-size:0.75rem;color:#666;">
      Testing: ${escapeHtml(idea.slice(0, 80))}
    </p>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
