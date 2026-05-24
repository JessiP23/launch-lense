// GET /api/market — Fetch market intelligence data
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const db = createServiceClient();
  try {
    const url = new URL(request.url);
    const org_id = url.searchParams.get('org_id');

    // Fetch completed sprints with angle results
    let sprintsQuery = db
      .from('sprints')
      .select('id, idea, genome, verdict, campaign, angles, created_at, org_id')
      .eq('state', 'COMPLETE')
      .order('created_at', { ascending: false });

    if (org_id) sprintsQuery = sprintsQuery.eq('org_id', org_id);

    const { data: sprints, error: sprintsError } = await sprintsQuery;

    if (sprintsError) return Response.json({ error: sprintsError.message }, { status: 500 });

    // Fetch sprint angle results for channel performance
    let angleResultsQuery = db
      .from('sprint_angle_results')
      .select('sprint_id, angle_id, channel, ctr, cpc_cents, spend_cents')
      .order('computed_at', { ascending: false });

    const { data: angleResults, error: angleError } = await angleResultsQuery;

    if (angleError) return Response.json({ error: angleError.message }, { status: 500 });

    return Response.json({ 
      sprints: sprints ?? [], 
      angleResults: angleResults ?? [] 
    });
  } catch (err) {
    console.error('[GET /api/market]', err);
    return Response.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}
