export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { fetchAdAccountHealth } from '@/lib/meta-api';
import { calculateHealthChecks } from '@/lib/healthgate';

// Cron: Health check every 15 minutes
// Configured via vercel.json: { "crons": [{ "path": "/api/cron/health", "schedule": "*/15 * * * *" }] }
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // 1. Fetch all ad accounts with access tokens
    const { data: accounts, error: accountsError } = await supabase
      .from('ad_accounts')
      .select('id, account_id, access_token, org_id, name');

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    if (!accounts || accounts.length === 0) {
      return Response.json({
        message: 'No accounts to check',
        accounts_checked: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const results: { account_id: string; score: number; status: string; error?: string }[] = [];

    for (const account of accounts) {
      if (!account.access_token) {
        results.push({
          account_id: account.account_id,
          score: 0,
          status: 'skipped',
          error: 'No access token',
        });
        continue;
      }

      try {
        // 2. Fetch health data from Meta
        const rawData = await fetchAdAccountHealth(
          account.account_id,
          account.access_token
        );

        // 3. Calculate health checks
        const result = calculateHealthChecks(rawData);
        const normalizedScore = result.score;
        const status = result.status;

        // 4. Insert health snapshot
        await supabase.from('health_snapshots').insert({
          ad_account_id: account.id,
          score: normalizedScore,
          status,
          checks: result.checks,
        });

        // 5. Update last_checked_at
        await supabase
          .from('ad_accounts')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', account.id);

        // 6. If status is red, pause all active tests for this account
        if (status === 'red') {
          const { data: activeTests } = await supabase
            .from('tests')
            .select('id, campaign_id')
            .eq('ad_account_id', account.id)
            .eq('status', 'active');

          if (activeTests && activeTests.length > 0) {
            const { updateCampaignStatus } = await import('@/lib/meta-api');
            for (const test of activeTests) {
              if (test.campaign_id) {
                try {
                  await updateCampaignStatus(
                    test.campaign_id,
                    account.access_token,
                    'PAUSED'
                  );
                  await supabase
                    .from('tests')
                    .update({ status: 'paused' })
                    .eq('id', test.id);
                  await supabase.from('annotations').insert({
                    test_id: test.id,
                    author: 'system',
                    message: `Auto-paused: Healthgate score dropped to ${normalizedScore} (red)`,
                  });
                } catch (pauseErr) {
                  console.error(`[health] Failed to pause test ${test.id}:`, pauseErr);
                }
              }
            }
          }
        }

        results.push({
          account_id: account.account_id,
          score: normalizedScore,
          status,
        });
      } catch (accountErr) {
        const errMsg = accountErr instanceof Error ? accountErr.message : String(accountErr);
        console.error(`[health] Error for account ${account.account_id}:`, errMsg);
        results.push({
          account_id: account.account_id,
          score: 0,
          status: 'error',
          error: errMsg,
        });
      }
    }

    return Response.json({
      message: 'Health cron executed',
      accounts_checked: accounts.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/health] Fatal error:', error);
    return Response.json({ error: 'Health cron failed' }, { status: 500 });
  }
}
