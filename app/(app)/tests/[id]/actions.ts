'use server';

import { createServiceClient } from '@/lib/supabase';
import { updateCampaignStatus } from '@/lib/meta-api';

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
      .select('access_token')
      .eq('id', test.ad_account_id)
      .single();

    let accessToken = account?.access_token;
    if (!accessToken || !String(accessToken).startsWith('EAA')) {
      accessToken = process.env.AD_ACCESS_TOKEN;
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
