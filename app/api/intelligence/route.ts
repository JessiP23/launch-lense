// GET /api/intelligence — Fetch intelligence dashboard data
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const db = createServiceClient();
  try {
    const url = new URL(request.url);
    const org_id = url.searchParams.get('org_id');

    // Fetch completed sprints with all required data
    let query = db
      .from('sprints')
      .select('id, idea, genome, verdict, campaign, created_at, org_id')
      .eq('state', 'COMPLETE')
      .order('created_at', { ascending: false });

    if (org_id) query = query.eq('org_id', org_id);

    const { data: sprints, error } = await query;

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ sprints: sprints ?? [] });
  } catch (err) {
    console.error('[GET /api/intelligence]', err);
    return Response.json({ error: 'Failed to fetch intelligence data' }, { status: 500 });
  }
}
