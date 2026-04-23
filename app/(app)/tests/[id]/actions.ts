'use server';

import { createServiceClient } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { updateCampaignStatus } from '@/lib/meta-api';
import { getToken } from '@/lib/meta';

const META_API = 'https://graph.facebook.com/v20.0';

interface PauseTestInput {
  testId: string;
  reason?: string;
}

interface PauseTestResult {
  success: boolean;
  error?: string;
}

export async function pauseTest(input: PauseTestInput): Promise<PauseTestResult> {
  const { testId, reason = 'Kill-Switch activated by user' } = input;

  const supabase = createServiceClient();

  try {
    // 1. Fetch test details
    const { data: test, error: testError } = await supabase
      .from('tests')
      .select('id, campaign_id, ad_account_id, status')
      .eq('id', testId)
      .single();

    if (testError || !test) {
      return { success: false, error: 'Test not found' };
    }

    if (test.status !== 'active') {
      return { success: false, error: `Test is already ${test.status}` };
    }

    // 2. Fetch access token
    const { data: account } = await supabase
      .from('ad_accounts')
      .select('account_id')
      .eq('id', test.ad_account_id)
      .single();

    let accessToken = account?.account_id ? await getToken(account.account_id) : null;
    if (!accessToken) {
      accessToken = process.env.AD_ACCESS_TOKEN || null;
    }

    if (!accessToken) {
      return { success: false, error: 'No access token for ad account' };
    }

    // 3. Pause campaign on Meta (< 60s SLA)
    if (test.campaign_id) {
      await updateCampaignStatus(
        test.campaign_id,
        accessToken,
        'PAUSED'
      );
    }

    // 4. Update test status in DB
    await supabase
      .from('tests')
      .update({ status: 'paused' })
      .eq('id', testId);

    // 5. Insert annotation
    await supabase.from('annotations').insert({
      test_id: testId,
      author: 'user',
      message: reason,
    });

    // 6. Insert kill-switch event
    await supabase.from('events').insert({
      test_id: testId,
      type: 'kill_switch',
      payload: {
        reason,
        paused_at: new Date().toISOString(),
        campaign_id: test.campaign_id,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[pauseTest] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pause campaign',
    };
  }
}

// ── Duplicate Ad (new image → pause old ad → create new ad) ────────────

interface DuplicateAdResult {
  success: boolean;
  newAdId?: string;
  error?: string;
}

export async function duplicateAd(
  testId: string,
  newImageHash: string
): Promise<DuplicateAdResult> {
  const supabase = createServiceClient();

  try {
    // 1. Fetch test
    const { data: test, error: testErr } = await supabase
      .from('tests')
      .select('id, ad_id, adset_id, ad_account_id, creative_id, name, lp_url, angles, version')
      .eq('id', testId)
      .single();

    if (testErr || !test) {
      return { success: false, error: 'Test not found' };
    }

    // 2. Resolve token
    const { data: account } = await supabaseAdmin
      .from('ad_accounts')
      .select('account_id')
      .eq('id', test.ad_account_id)
      .single();

    let token = account?.account_id ? await getToken(account.account_id) : null;
    if (!token) {
      token = process.env.AD_ACCESS_TOKEN || null;
    }
    if (!token) {
      return { success: false, error: 'No access token' };
    }

    const actId = account?.account_id || test.ad_account_id;
    const angle = (test.angles as { headline?: string; primary_text?: string }[])?.[0];
    const version = (test.version || 1) + 1;

    // 3. Pause old ad (never edit live ads)
    if (test.ad_id) {
      await fetch(`${META_API}/${test.ad_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAUSED', access_token: token }),
      });
    }

    // 4. Create new creative with new image_hash
    const creativeRes = await fetch(`${META_API}/${actId}/adcreatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${test.name} v${version}`,
        access_token: token,
        object_story_spec: {
          page_id: process.env.META_PAGE_ID || null,
          link_data: {
            link: test.lp_url || `${process.env.NEXT_PUBLIC_APP_URL}/lp/${testId}`,
            message: angle?.primary_text || '',
            image_hash: newImageHash,
          },
        },
      }),
    });
    const creativeData = await creativeRes.json();
    if (creativeData.error) {
      return { success: false, error: `Creative: ${creativeData.error.message}` };
    }

    // 5. Create new ad in same adset
    const adRes = await fetch(`${META_API}/${actId}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${test.name} v${version}`,
        adset_id: test.adset_id,
        creative: { creative_id: creativeData.id },
        status: 'ACTIVE',
        access_token: token,
      }),
    });
    const adData = await adRes.json();
    if (adData.error) {
      return { success: false, error: `Ad: ${adData.error.message}` };
    }

    // 6. Update DB
    await supabase
      .from('tests')
      .update({
        ad_id: adData.id,
        creative_id: creativeData.id,
        version,
      })
      .eq('id', testId);

    await supabase.from('annotations').insert({
      test_id: testId,
      author: 'system',
      message: `Creative updated v${version}: new image. Old ad paused, new ad ${adData.id} live.`,
    });

    return { success: true, newAdId: adData.id };
  } catch (error) {
    console.error('[duplicateAd] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Duplicate ad failed',
    };
  }
}
