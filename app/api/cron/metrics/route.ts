export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getCampaignInsights, updateCampaignStatus } from '@/lib/meta-api';

// Cron: Fetch metrics every 5 minutes for active tests
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // 1. Query all active tests
    const { data: activeTests, error: queryError } = await supabase
      .from('tests')
      .select('id, campaign_id, ad_account_id, budget_cents')
      .eq('status', 'active')
      .not('campaign_id', 'is', null);

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!activeTests || activeTests.length === 0) {
      return Response.json({
        message: 'No active tests',
        tests_checked: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const results: { test_id: string; status: string; error?: string }[] = [];

    for (const test of activeTests) {
      try {
        // 2. Fetch access token for the ad account
        const { data: account } = await supabase
          .from('ad_accounts')
          .select('access_token')
          .eq('id', test.ad_account_id)
          .single();

        if (!account?.access_token) {
          results.push({ test_id: test.id, status: 'skipped', error: 'No access token' });
          continue;
        }

        // 3. GET /{campaign_id}/insights from Meta
        const insights = await getCampaignInsights(
          test.campaign_id,
          account.access_token
        ) as {
          data?: Array<{
            impressions?: string;
            clicks?: string;
            spend?: string;
            ctr?: string;
            cpc?: string;
            actions?: Array<{ action_type: string; value: string }>;
          }>;
        };

        const insightData = insights.data?.[0];
        if (!insightData) {
          results.push({ test_id: test.id, status: 'no_data' });
          continue;
        }

        // 4. Parse actions for 'lead' and landing_page_view
        const actions = insightData.actions || [];
        const leads = parseInt(
          actions.find((a) => a.action_type === 'lead')?.value || '0',
          10
        );
        const lpViews = parseInt(
          actions.find(
            (a) =>
              a.action_type === 'landing_page_view' ||
              a.action_type === 'onsite_conversion.lead_grouped'
          )?.value || '0',
          10
        );

        const spendCents = Math.round(parseFloat(insightData.spend || '0') * 100);
        const impressions = parseInt(insightData.impressions || '0', 10);
        const clicks = parseInt(insightData.clicks || '0', 10);

        // 5. Insert metrics event
        await supabase.from('events').insert({
          test_id: test.id,
          type: 'metrics',
          payload: {
            spend_cents: spendCents,
            impressions,
            clicks,
            lp_views: lpViews,
            leads,
            ctr: parseFloat(insightData.ctr || '0'),
            cpc: parseFloat(insightData.cpc || '0'),
            fetched_at: new Date().toISOString(),
          },
        });

        // 6. Spend guard: pause if over budget
        if (spendCents >= test.budget_cents) {
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
            message: `Auto-paused: spend $${(spendCents / 100).toFixed(2)} reached budget $${(test.budget_cents / 100).toFixed(2)}`,
          });

          await supabase.from('events').insert({
            test_id: test.id,
            type: 'anomaly',
            payload: {
              reason: 'budget_exceeded',
              spend_cents: spendCents,
              budget_cents: test.budget_cents,
            },
          });

          results.push({ test_id: test.id, status: 'paused_budget' });
        } else {
          results.push({ test_id: test.id, status: 'ok' });
        }
      } catch (testErr) {
        const errMsg = testErr instanceof Error ? testErr.message : String(testErr);
        console.error(`[cron/metrics] Error for test ${test.id}:`, errMsg);
        results.push({ test_id: test.id, status: 'error', error: errMsg });
      }
    }

    return Response.json({
      message: 'Metrics cron executed',
      tests_checked: activeTests.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/metrics] Fatal error:', error);
    return Response.json({ error: 'Metrics cron failed' }, { status: 500 });
  }
}
