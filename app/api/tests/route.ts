export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();

  try {
    const { data: tests, error } = await supabase
      .from('tests')
      .select(
        'id, name, status, verdict, lp_url, created_at, ad_account_id'
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Pull latest metrics for each test from events table
    const testIds = (tests || []).map((t) => t.id);

    let metricsMap: Record<string, { spend_cents: number; leads: number; ctr: number }> = {};

    if (testIds.length > 0) {
      const { data: events } = await supabase
        .from('events')
        .select('test_id, payload')
        .in('test_id', testIds)
        .eq('type', 'metrics')
        .order('created_at', { ascending: false });

      // Take the most recent event per test
      for (const ev of events || []) {
        if (!metricsMap[ev.test_id]) {
          const p = ev.payload as Record<string, number> | null;
          metricsMap[ev.test_id] = {
            spend_cents: p?.spend_cents || 0,
            leads: p?.leads || 0,
            ctr: p?.ctr || 0,
          };
        }
      }
    }

    const enriched = (tests || []).map((t) => ({
      ...t,
      ...(metricsMap[t.id] || { spend_cents: 0, leads: 0, ctr: 0 }),
    }));

    return Response.json({ tests: enriched });
  } catch (err) {
    console.error('[/api/tests] Error:', err);
    return Response.json({ error: 'Failed to fetch tests' }, { status: 500 });
  }
}
