export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/** POST /api/tests — create a genome-draft test record (no ad account required) */
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  try {
    const body = await request.json() as { idea?: string; genome?: Record<string, unknown> };
    const { idea, genome } = body;

    if (!idea || typeof idea !== 'string' || idea.trim().length < 5) {
      return Response.json({ error: 'idea required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('tests')
      .insert({
        name: idea.trim().slice(0, 120),
        status: 'draft',
        idea: idea.trim(),
        // Store genome result in a JSON column if it exists, else ignore
        ...(genome ? { genome_result: genome } : {}),
      })
      .select('id')
      .single();

    if (error) {
      // If genome_result column doesn't exist, retry without it
      if (error.message.includes('genome_result')) {
        const { data: data2, error: error2 } = await supabase
          .from('tests')
          .insert({ name: idea.trim().slice(0, 120), status: 'draft', idea: idea.trim() })
          .select('id')
          .single();
        if (error2 || !data2) return Response.json({ error: error2?.message }, { status: 500 });
        return Response.json({ id: data2.id });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ id: data.id });
  } catch (err) {
    console.error('[POST /api/tests]', err);
    return Response.json({ error: 'Failed to create test' }, { status: 500 });
  }
}

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
