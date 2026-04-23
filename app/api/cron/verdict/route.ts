export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { updateCampaignStatus } from '@/lib/meta-api';
import { getToken } from '@/lib/meta';

interface MetricsPayload {
  spend_cents?: number;
  impressions?: number;
  clicks?: number;
  lp_views?: number;
  leads?: number;
}

// Cron: Check for verdict eligibility every 60 minutes
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // 1. Query tests where now > created_at + 48h AND status='active'
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: eligibleTests, error: queryError } = await supabase
      .from('tests')
      .select('id, campaign_id, ad_account_id, budget_cents, vertical, name, idea')
      .eq('status', 'active')
      .lt('created_at', cutoff);

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!eligibleTests || eligibleTests.length === 0) {
      return Response.json({
        message: 'No tests eligible for verdict',
        verdicts_issued: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const verdicts: { test_id: string; verdict: string; error?: string }[] = [];

    for (const test of eligibleTests) {
      try {
        // 2. Aggregate metrics from events
        const { data: events } = await supabase
          .from('events')
          .select('payload')
          .eq('test_id', test.id)
          .eq('type', 'metrics');

        const totals = (events || []).reduce(
          (acc, e) => {
            const p = e.payload as MetricsPayload;
            return {
              spend_cents: acc.spend_cents + (p.spend_cents || 0),
              impressions: acc.impressions + (p.impressions || 0),
              clicks: acc.clicks + (p.clicks || 0),
              lp_views: acc.lp_views + (p.lp_views || 0),
              leads: acc.leads + (p.leads || 0),
            };
          },
          { spend_cents: 0, impressions: 0, clicks: 0, lp_views: 0, leads: 0 }
        );

        // 3. Compute CTR, CVR, CPA
        const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
        const cvr = totals.lp_views > 0 ? totals.leads / totals.lp_views : 0;
        const cpaCents = totals.leads > 0 ? totals.spend_cents / totals.leads : totals.spend_cents;

        // 4. Fetch benchmarks for vertical
        const { data: benchmark } = await supabase
          .from('benchmarks')
          .select('*')
          .eq('vertical', test.vertical || 'saas')
          .single();

        const benchCpa = benchmark?.avg_cpa_cents || 4500;
        const benchCvr = benchmark?.avg_cvr || 0.025;

        // 5. Apply verdict logic
        let verdict: string;

        const isGo =
          cpaCents < benchCpa * 0.8 && cvr > 0.02 && totals.leads > 5;

        const isNoGo =
          cpaCents > 6000 || cvr < 0.005 || (totals.leads === 0 && totals.spend_cents > 20000);

        if (isGo) {
          verdict = 'GO';
        } else if (isNoGo) {
          verdict = 'NO-GO';
        } else {
          verdict = 'INCONCLUSIVE';
        }

        // 6. Pause the campaign
        if (test.campaign_id) {
          try {
            const { data: account } = await supabase
              .from('ad_accounts')
              .select('account_id')
              .eq('id', test.ad_account_id)
              .single();

            const accessToken = account?.account_id
              ? (await getToken(account.account_id)) || process.env.AD_ACCESS_TOKEN || null
              : null;

            if (accessToken) {
              await updateCampaignStatus(
                test.campaign_id,
                accessToken,
                'PAUSED'
              );
            }
          } catch (pauseErr) {
            console.error(`[verdict] Failed to pause campaign for test ${test.id}:`, pauseErr);
          }
        }

        // 7. Trigger PDF generation
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        let verdictPdfUrl: string | null = null;
        try {
          const pdfRes = await fetch(`${appUrl}/api/reports/${test.id}`);
          if (pdfRes.ok) {
            // Upload PDF to Supabase Storage
            const pdfBuffer = await pdfRes.arrayBuffer();
            const pdfPath = `verdicts/${test.id}.pdf`;
            await supabase.storage
              .from('reports')
              .upload(pdfPath, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true,
              });

            const { data: pdfUrl } = supabase.storage
              .from('reports')
              .getPublicUrl(pdfPath);

            verdictPdfUrl = pdfUrl?.publicUrl || null;
          }
        } catch (pdfErr) {
          console.error(`[verdict] PDF generation failed for test ${test.id}:`, pdfErr);
        }

        // 8. Update test status and verdict
        await supabase
          .from('tests')
          .update({
            status: 'completed',
            verdict,
            verdict_pdf_url: verdictPdfUrl,
          })
          .eq('id', test.id);

        // 9. Insert verdict event
        await supabase.from('events').insert({
          test_id: test.id,
          type: 'verdict',
          payload: {
            verdict,
            metrics: totals,
            ctr,
            cvr,
            cpa_cents: cpaCents,
            benchmark: {
              avg_cpa_cents: benchCpa,
              avg_cvr: benchCvr,
              avg_ctr: benchmark?.avg_ctr || 0.012,
            },
            pdf_url: verdictPdfUrl,
          },
        });

        // 10. Insert annotation
        await supabase.from('annotations').insert({
          test_id: test.id,
          author: 'system',
          message: `Verdict: ${verdict}. CPA: $${(cpaCents / 100).toFixed(0)} (bench: $${(benchCpa / 100).toFixed(0)}), CVR: ${(cvr * 100).toFixed(2)}% (bench: ${(benchCvr * 100).toFixed(2)}%), Leads: ${totals.leads}`,
        });

        // 11. Update benchmark sample size
        if (benchmark) {
          await supabase
            .from('benchmarks')
            .update({ sample_size: (benchmark.sample_size || 0) + 1 })
            .eq('vertical', test.vertical || 'saas');
        }

        verdicts.push({ test_id: test.id, verdict });
      } catch (testErr) {
        const errMsg = testErr instanceof Error ? testErr.message : String(testErr);
        console.error(`[verdict] Error for test ${test.id}:`, errMsg);
        verdicts.push({ test_id: test.id, verdict: 'ERROR', error: errMsg });
      }
    }

    return Response.json({
      message: 'Verdict cron executed',
      verdicts_issued: verdicts.length,
      verdicts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/verdict] Fatal error:', error);
    return Response.json({ error: 'Verdict cron failed' }, { status: 500 });
  }
}
