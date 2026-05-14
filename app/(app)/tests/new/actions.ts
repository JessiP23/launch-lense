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
import { getToken } from '@/lib/meta';
import { calculateHealthChecks } from '@/lib/healthgate';
import { resolveMetaCtaType } from '@/lib/meta/cta';

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
  imageHash?: string;
  brandName?: string;
}

interface CreateTestResult {
  success: boolean;
  testId?: string;
  error?: string;
}

async function fetchAccountWithOptionalPageId(requestedAccountId: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedAccountId);
  const isMetaId = requestedAccountId.startsWith('act_');
  const lookupColumn = isUuid ? 'id' : 'account_id';

  // First try with page_id for schemas that include it.
  const withPage = await supabaseAdmin
    .from('ad_accounts')
    .select('id, account_id, page_id')
    .eq(lookupColumn, requestedAccountId)
    .maybeSingle();

  if (!withPage.error) {
    return {
      account: withPage.data as { id: string; account_id: string; page_id?: string | null } | null,
      isUuid,
      isMetaId,
      accountErrMsg: null,
    };
  }

  // If page_id column does not exist, fallback to minimal fields.
  if (withPage.error.message.includes('column ad_accounts.page_id does not exist')) {
    const withoutPage = await supabaseAdmin
      .from('ad_accounts')
      .select('id, account_id')
      .eq(lookupColumn, requestedAccountId)
      .maybeSingle();
    return {
      account: withoutPage.data
        ? ({ ...withoutPage.data, page_id: null } as {
            id: string;
            account_id: string;
            page_id?: string | null;
          })
        : null,
      isUuid,
      isMetaId,
      accountErrMsg: withoutPage.error?.message || null,
    };
  }

  return {
    account: null,
    isUuid,
    isMetaId,
    accountErrMsg: withPage.error.message,
  };
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
    imageHash,
    brandName,
  } = input;

  if (!orgId || !adAccountId) {
    return { success: false, error: 'Missing required account information. Connect an ad account first.' };
  }

  // ── Resolve ad account row (accept internal UUID or Meta act_ ID) ───
  const requestedAccountId = adAccountId.trim();
  const {
    account,
    isUuid,
    isMetaId,
    accountErrMsg,
  } = await fetchAccountWithOptionalPageId(requestedAccountId);

  if (!account) {
    console.error('[createTest] account lookup failed', {
      requestedAccountId,
      isUuid,
      isMetaId,
      accountErrMsg,
    });
    return { success: false, error: 'Ad account not found in database. Reconnect account and try again.' };
  }

  // ── 0. Server-side Healthgate check ──────────────────────────────────
  const { data: latestSnapshot } = await supabaseAdmin
    .from('health_snapshots')
    .select('payload')
    .eq('ad_account_id', account.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestSnapshot?.payload) {
    const health = calculateHealthChecks(latestSnapshot.payload);
    if (health.status === 'red') {
      return {
        success: false,
        error: `Healthgate blocked: score ${health.score}/100. Fix account issues before launching.`,
      };
    }
  }

  // Meta account ID is the act_xxx string — NOT the internal UUID
  // Strip act_ prefix since meta-api.ts functions add it back
  const metaAccountId = account.account_id.replace(/^act_/, ''); // e.g. "727146616453623"

  let accessToken = await getToken(account.account_id);
  if (!accessToken) {
    accessToken = process.env.AD_ACCESS_TOKEN || null;
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
        ad_account_id: account.id,
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

    const metaAppId = process.env.META_APP_ID;
    if (!metaAppId) {
      throw new Error('META_APP_ID is missing');
    }
    if (process.env.NODE_ENV === 'development') {
      const assets = await fetch(
        `https://graph.facebook.com/v20.0/${metaAppId}/advertisable_applications?access_token=${accessToken}`
      );
      const assetsData = await assets.json();
      console.log('[createTest] APP_ASSETS:', assetsData);

      // Some app types do not expose this edge; skip check instead of false-blocking deploy.
      if (assetsData?.error?.code === 100) {
        console.warn('[createTest] APP_ASSETS edge unavailable; skipping dev asset check');
      } else {
        const assetList = Array.isArray(assetsData?.data) ? assetsData.data : [];
        const hasAccountAsset = assetList.some((asset: { id?: string; account_id?: string }) => {
          const id = asset.id || asset.account_id || '';
          return id === account.account_id || id === metaAccountId || id === `act_${metaAccountId}`;
        });
        if (!hasAccountAsset) {
          throw new Error('Add ad account to App in Marketing API Settings');
        }
      }
    }

    // ── 3. Create campaign ─────────────────────────────────────────────
    const campaignResult = await createCampaign(metaAccountId, accessToken, {
      name: `[LaunchLense] ${idea.slice(0, 60)}`,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    });
    const campaignId = (campaignResult as { id: string }).id;
    createdObjects.push({ type: 'campaign', id: campaignId });

    // ── 4. Create ad set ───────────────────────────────────────────────
    const adSetResult = await createAdSet(metaAccountId, accessToken, {
      campaign_id: campaignId,
      name: `${angle.headline.slice(0, 40)} - Broad US`,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      bid_amount: 100,
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
    const linkData: Record<string, unknown> = {
      message: angle.primary_text,
      name: angle.headline,
      call_to_action: { type: resolveMetaCtaType(angle.cta) },
      link: lpUrl,
    };
    if (imageHash) {
      linkData.image_hash = imageHash;
    }

    const resolvedPageId = account.page_id || process.env.META_PAGE_ID || null;
    if (!resolvedPageId) {
      throw new Error('Missing Facebook Page. Set META_PAGE_ID or add page_id on ad_accounts.');
    }

    let objectStorySpec: Record<string, unknown>;
    try {
      const pageRes = await fetch(
        `https://graph.facebook.com/v20.0/${resolvedPageId}?fields=name&access_token=${accessToken}`
      );
      const pageData = await pageRes.json();
      if (pageData?.error) {
        throw new Error(pageData.error.message || 'Invalid page_id');
      }
      objectStorySpec = { page_id: resolvedPageId, link_data: linkData };
      console.log('[createTest] USING_PAGE_ID:', resolvedPageId);
    } catch {
      throw new Error('Invalid Facebook Page for this token. Check META_PAGE_ID/page permissions.');
    }

    const creativeResult = await createAdCreative(metaAccountId, accessToken, {
      name: `Creative - ${angle.headline.slice(0, 40)}`,
      object_story_spec: objectStorySpec,
    });
    const creativeId = (creativeResult as { id: string }).id;
    createdObjects.push({ type: 'creative', id: creativeId });

    // ── 6. Create ad ───────────────────────────────────────────────────
    const adResult = await createAd(metaAccountId, accessToken, {
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
/**
 * Demo Deploy — creates a test row with simulated Meta IDs + fake GO metrics.
 * Does NOT call Meta API. Used for investor demos / pre-seed recordings.
 */
export async function createDemoTest(input: CreateTestInput): Promise<CreateTestResult> {
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

  if (!orgId) {
    return { success: false, error: 'Missing org information. Please sign in and try again.' };
  }

  // Demo deploys accept a placeholder adAccountId (e.g. 'demo-account')
  const resolvedAdAccountId = adAccountId || orgId;

  // UUID validation — Supabase columns are typed uuid; skip non-UUID placeholders
  const UUID_RE_TOP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE_TOP.test(orgId)) {
    return { success: false, error: 'No valid org session found. Please sign in and try the demo again.' };
  }

  const supabase = createServiceClient();

  // Only include ad_account_id if it looks like a real UUID (demo fallbacks are not UUIDs)
  const realAdAccountId = UUID_RE_TOP.test(resolvedAdAccountId ?? '') ? resolvedAdAccountId : null;

  try {
    // 1. Insert test row
    const shareToken = crypto.randomUUID().slice(0, 8);
    const demoId = `demo_${Date.now()}`;

    const { data: testData, error: insertError } = await supabase
      .from('tests')
      .insert({
        org_id: orgId,
        ...(realAdAccountId ? { ad_account_id: realAdAccountId } : {}),
        name: idea.slice(0, 120),
        status: 'active',
        budget_cents: budgetCents,
        vertical,
        idea,
        audience,
        offer,
        angles: [angle],
        share_token: shareToken,
        campaign_id: `demo_campaign_${demoId}`,
        adset_id: `demo_adset_${demoId}`,
        ad_id: `demo_ad_${demoId}`,
        creative_id: `demo_creative_${demoId}`,
        lp_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/lp/${demoId}`,
      })
      .select('id')
      .single();

    if (insertError || !testData) {
      throw new Error(`DB insert failed: ${insertError?.message || 'unknown'}`);
    }

    // 2. Insert realistic demo metrics (GO-quality)
    await supabase.from('events').insert({
      test_id: testData.id,
      type: 'metrics',
      payload: {
        impressions: 2247,
        clicks: 94,
        spend_cents: 48700,
        lp_views: 218,
        leads: 14,
      },
    });

    // 3. Insert a second event row for realism (day 2)
    await supabase.from('events').insert({
      test_id: testData.id,
      type: 'metrics',
      payload: {
        impressions: 1834,
        clicks: 72,
        spend_cents: 41200,
        lp_views: 167,
        leads: 11,
      },
    });

    // 4. Insert launch annotation
    await supabase.from('annotations').insert({
      test_id: testData.id,
      author: 'system',
      message: `[DEMO] Campaign deployed. Budget: $${(budgetCents / 100).toFixed(0)} | Angle: "${angle.headline}"`,
    });

    return { success: true, testId: testData.id };
  } catch (error) {
    console.error('[createDemoTest] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Demo deploy failed',
    };
  }
}

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
