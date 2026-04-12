export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// Force GO verdict — dev only, for demo recording
// Inserts fake metrics then triggers verdict
export async function POST(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Disabled in production' }, { status: 403 });
  }

  try {
    const { test_id } = await request.json();
    if (!test_id) {
      return Response.json({ error: 'test_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Verify test exists and is active
    const { data: test, error: testErr } = await supabase
      .from('tests')
      .select('id, status, campaign_id, ad_account_id, budget_cents, vertical, name')
      .eq('id', test_id)
      .single();

    if (testErr || !test) {
      return Response.json({ error: 'Test not found' }, { status: 404 });
    }

    // 2. Insert realistic GO metrics
    // 2000 impressions, 80 clicks (4% CTR), 200 LP views, 12 leads, $487 spend
    await supabase.from('events').insert({
      test_id,
      type: 'metrics',
      payload: {
        impressions: 2000,
        clicks: 80,
        spend_cents: 48700,
        lp_views: 200,
        leads: 12,
      },
    });

    // 3. Run verdict inline (same logic as cron/verdict but for one test)
    const { data: events } = await supabase
      .from('events')
      .select('payload')
      .eq('test_id', test_id)
      .eq('type', 'metrics');

    const totals = (events || []).reduce(
      (acc, e) => {
        const p = e.payload as Record<string, number>;
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

    const cvr = totals.lp_views > 0 ? totals.leads / totals.lp_views : 0;
    const cpaCents = totals.leads > 0 ? totals.spend_cents / totals.leads : totals.spend_cents;

    // Force GO verdict
    const verdict = 'GO';

    // 4. Generate PDF
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let verdictPdfUrl: string | null = null;
    try {
      const pdfRes = await fetch(`${appUrl}/api/reports/${test_id}`);
      if (pdfRes.ok) {
        const pdfBuffer = await pdfRes.arrayBuffer();
        const pdfPath = `verdicts/${test_id}.pdf`;
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
      console.error('[force-go] PDF generation failed:', pdfErr);
    }

    // 5. Update test → completed + GO
    await supabase
      .from('tests')
      .update({
        status: 'completed',
        verdict,
        verdict_pdf_url: verdictPdfUrl,
      })
      .eq('id', test_id);

    // 6. Insert verdict event
    await supabase.from('events').insert({
      test_id,
      type: 'verdict',
      payload: {
        verdict,
        forced: true,
        metrics: totals,
        cvr,
        cpa_cents: cpaCents,
        pdf_url: verdictPdfUrl,
      },
    });

    // 7. Insert annotation
    await supabase.from('annotations').insert({
      test_id,
      author: 'system',
      message: `Verdict: GO (forced). CPA: $${(cpaCents / 100).toFixed(0)}, CVR: ${(cvr * 100).toFixed(1)}%, Leads: ${totals.leads}. $${(totals.spend_cents / 100).toFixed(0)} spent → saved ~$35k.`,
    });

    return Response.json({
      success: true,
      verdict,
      metrics: totals,
      pdf_url: verdictPdfUrl,
    });
  } catch (error) {
    console.error('[force-go] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Force GO failed' },
      { status: 500 }
    );
  }
}
