// POST /api/sprint/[sprint_id]/healthgate
// Dispatches all 4 HealthgateAgents in parallel.
// Channels that return BLOCKED are removed from active_channels.
// If ALL channels BLOCKED → sprint state = BLOCKED.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { dispatchHealthgate } from '@/lib/sprint-machine';
import type { Platform } from '@/lib/agents/types';
import { captureServerEvent } from '@/lib/analytics/server-posthog';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const { data: sprint } = await db.from('sprints').select('*').eq('id', sprint_id).single();
  if (!sprint) return Response.json({ error: 'Sprint not found' }, { status: 404 });
  if (sprint.state !== 'GENOME_DONE') {
    return Response.json({ error: `Sprint is in ${sprint.state} — Genome must complete first` }, { status: 409 });
  }

  // Body: per-channel account data (what we know from connected accounts)
  // If not provided, we use empty objects — Healthgate will score them accordingly
  const body = await req.json().catch(() => ({})) as {
    channel_data?: Partial<Record<Platform, Record<string, unknown>>>;
  };
  const channelData = body.channel_data ?? {};

  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'healthgate',
    event_type: 'started',
    payload: { channels: sprint.active_channels },
  });

  const updated = await dispatchHealthgate(sprint_id, channelData);

  // Log per-channel results
  if (updated.healthgate) {
    const events = Object.values(updated.healthgate).map((h) => ({
      sprint_id,
      agent: 'healthgate',
      event_type: h.status === 'BLOCKED' ? 'blocked' : 'completed',
      channel: h.channel,
      payload: {
        score: h.score,
        status: h.status,
        blocking_issues: h.blocking_issues,
      },
    }));
    if (events.length) await db.from('sprint_events').insert(events);
  }

  if (updated.healthgate) {
    for (const h of Object.values(updated.healthgate)) {
      await captureServerEvent(sprint_id, 'healthgate_completed', {
        sprint_id,
        channel: h.channel,
        score: h.score,
        status: h.status,
        failing_checks_count: h.checks?.filter((c) => !c.passed).length ?? 0,
      });
    }
  }

  return Response.json({
    sprint_id,
    state: updated.state,
    active_channels: updated.active_channels,
    healthgate: updated.healthgate,
    blocked_reason: updated.blocked_reason,
  });
}
