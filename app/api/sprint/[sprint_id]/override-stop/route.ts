// POST /api/sprint/[sprint_id]/override-stop
// Explicit user override for demo/founder judgment when Genome returns STOP.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const { data: sprint, error } = await db
    .from('sprints')
    .select('id, state, genome')
    .eq('id', sprint_id)
    .single();

  if (error || !sprint) return Response.json({ error: 'Sprint not found' }, { status: 404 });
  if (sprint.state !== 'BLOCKED') {
    return Response.json({ error: `Sprint is in ${sprint.state}; override only applies to BLOCKED sprints` }, { status: 409 });
  }
  if (!sprint.genome) {
    return Response.json({ error: 'Genome output is required before override' }, { status: 409 });
  }

  const { data: updated, error: updateError } = await db
    .from('sprints')
    .update({
      state: 'GENOME_DONE',
      blocked_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sprint_id)
    .select('*')
    .single();

  if (updateError || !updated) {
    return Response.json({ error: updateError?.message ?? 'Failed to override STOP' }, { status: 500 });
  }

  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'orchestrator',
    event_type: 'override_stop',
    payload: { reason: 'User chose to continue the canvas workflow after Genome STOP.' },
  });

  return Response.json({ sprint: updated });
}
