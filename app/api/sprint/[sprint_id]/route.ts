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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();
  const body = await req.json().catch(() => ({})) as {
    angles?: unknown;
    landing?: unknown;
    integrations?: unknown;
    post_sprint?: unknown;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.angles) patch.angles = body.angles;
  if (body.landing) patch.landing = body.landing;
  if (body.integrations) patch.integrations = body.integrations;
  if (body.post_sprint) patch.post_sprint = body.post_sprint;

  if (!body.angles && !body.landing && !body.integrations && !body.post_sprint) {
    return Response.json({ error: 'No supported sprint fields provided' }, { status: 400 });
  }

  const { data, error } = await db
    .from('sprints')
    .update(patch)
    .eq('id', sprint_id)
    .select('*')
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? 'Failed to update sprint' }, { status: 500 });
  }

  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'orchestrator',
    event_type: 'edited',
    payload: { fields: Object.keys(patch).filter((key) => key !== 'updated_at') },
  });

  return Response.json({ sprint: data });
}
