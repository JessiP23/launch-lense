// GET /api/sprint/[sprint_id] — Retrieve full sprint state

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const { data, error } = await db
    .from('sprints')
    .select('*')
    .eq('id', sprint_id)
    .single();

  if (error || !data) {
    return Response.json({ error: 'Sprint not found' }, { status: 404 });
  }

  // Fetch recent events
  const { data: events } = await db
    .from('sprint_events')
    .select('agent, event_type, channel, payload, created_at')
    .eq('sprint_id', sprint_id)
    .order('created_at', { ascending: false })
    .limit(50);

  return Response.json({ ...data, events: events ?? [] });
}
