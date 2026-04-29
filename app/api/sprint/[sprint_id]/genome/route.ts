// POST /api/sprint/[sprint_id]/genome
// Dispatches GenomeAgent and advances sprint state.
// If composite < 40: state → BLOCKED (halts sprint, surfaces pivot_brief)
// If GO/ITERATE: state → GENOME_DONE (ready for healthgate)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { dispatchGenome } from '@/lib/sprint-machine';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  // Validate sprint exists and is in the right state
  const { data: sprint } = await db.from('sprints').select('*').eq('id', sprint_id).single();
  if (!sprint) return Response.json({ error: 'Sprint not found' }, { status: 404 });
  if (!['IDLE', 'GENOME_DONE'].includes(sprint.state)) {
    return Response.json({ error: `Sprint is in ${sprint.state} — cannot run Genome now` }, { status: 409 });
  }

  // Log start
  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'genome',
    event_type: 'started',
    payload: { idea: sprint.idea },
  });

  const updated = await dispatchGenome(sprint_id);

  // Log completion
  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'genome',
    event_type: updated.state === 'BLOCKED' ? 'blocked' : 'completed',
    payload: {
      signal: updated.genome?.signal,
      composite: updated.genome?.composite,
      scores: updated.genome?.scores,
      blocked_reason: updated.blocked_reason,
      data_source: updated.genome?.data_source,
      elapsed_ms: updated.genome?.elapsed_ms,
    },
  });

  return Response.json({
    sprint_id,
    state: updated.state,
    genome: updated.genome,
    blocked_reason: updated.blocked_reason,
  });
}
