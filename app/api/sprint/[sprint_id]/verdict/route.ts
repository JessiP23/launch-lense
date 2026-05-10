// POST /api/sprint/[sprint_id]/verdict
// Runs VerdictAgent against completed campaign data.
// Also accepts mock metrics for testing without real campaigns.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { dispatchVerdict, patchSprint } from '@/lib/sprint-machine';
import type { Platform, CampaignAgentOutput } from '@/lib/agents/types';
import { captureServerEvent } from '@/lib/analytics/server-posthog';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const { data: sprint } = await db.from('sprints').select('*').eq('id', sprint_id).single();
  if (!sprint) return Response.json({ error: 'Sprint not found' }, { status: 404 });

  // Allow mock_campaigns for testing / demo — inject before calling verdict
  const body = await req.json().catch(() => ({})) as {
    mock_campaigns?: Partial<Record<Platform, CampaignAgentOutput>>;
  };

  if (body.mock_campaigns) {
    await patchSprint(sprint_id, {
      campaign: body.mock_campaigns as Record<Platform, CampaignAgentOutput>,
    });
  }

  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'verdict',
    event_type: 'started',
    payload: { channels: sprint.active_channels },
  });

  const updated = await dispatchVerdict(sprint_id);

  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'verdict',
    event_type: updated.state === 'BLOCKED' ? 'blocked' : 'completed',
    payload: {
      verdict: updated.verdict?.verdict,
      confidence: updated.verdict?.confidence,
      channel_verdicts: updated.verdict?.channel_verdicts,
      winning_angle: updated.verdict?.cross_channel_winning_angle,
    },
  });

  if (updated.verdict && updated.state === 'COMPLETE') {
    await captureServerEvent(sprint_id, 'verdict_generated', {
      sprint_id,
      verdict: updated.verdict.verdict,
      confidence_score: updated.verdict.confidence,
      channels_tested: sprint.active_channels,
      weighted_ctr: updated.verdict.aggregate_metrics.weighted_blended_ctr,
      total_spend: updated.verdict.aggregate_metrics.total_spend_cents / 100,
      winning_angle_archetype: updated.verdict.cross_channel_winning_angle,
    });
  }

  return Response.json({
    sprint_id,
    state: updated.state,
    verdict: updated.verdict,
    blocked_reason: updated.blocked_reason,
  });
}
