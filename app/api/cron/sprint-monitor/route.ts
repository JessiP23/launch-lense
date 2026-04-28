// GET /api/cron/sprint-monitor
// Runs every 4 hours via Vercel Cron.
// Polls CAMPAIGN_MONITORING sprints → checks halt conditions → dispatches VerdictAgent when ready.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { pollCampaignMetrics, dispatchVerdict } from '@/lib/sprint-machine';
import type { Platform, CampaignAgentOutput } from '@/lib/agents/types';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();

  // 1. Find all CAMPAIGN_RUNNING + CAMPAIGN_MONITORING sprints
  const { data: sprints, error } = await db
    .from('sprints')
    .select('*')
    .in('state', ['CAMPAIGN_RUNNING', 'CAMPAIGN_MONITORING'])
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!sprints || sprints.length === 0) {
    return Response.json({ message: 'No active campaigns to monitor', polled: 0 });
  }

  const results: { sprint_id: string; action: string; state: string }[] = [];

  for (const sprint of sprints) {
    try {
      const campaign = sprint.campaign as Record<Platform, CampaignAgentOutput> | null;
      if (!campaign) continue;

      // Build simulated metrics update (in production: call platform APIs per channel)
      // For now: check elapsed time and budget — real polling would hit Meta/Google APIs here
      const metricsUpdate: Partial<Record<Platform, Partial<CampaignAgentOutput>>> = {};
      let allChannelsHalted = true;

      for (const ch of sprint.active_channels as Platform[]) {
        const c = campaign[ch];
        if (!c) continue;

        const startTime = c.campaign_start_time ? new Date(c.campaign_start_time).getTime() : 0;
        const elapsed48h = startTime > 0 && (Date.now() - startTime) >= 48 * 60 * 60 * 1000;
        const budgetExhausted = c.spent_cents >= c.budget_cents;

        metricsUpdate[ch] = {
          last_polled_at: new Date().toISOString(),
          status: (elapsed48h || budgetExhausted) ? 'COMPLETE' : 'ACTIVE',
        };

        if (!elapsed48h && !budgetExhausted) {
          allChannelsHalted = false;
        }
      }

      await pollCampaignMetrics(sprint.id, metricsUpdate);

      await db.from('sprint_events').insert({
        sprint_id: sprint.id,
        agent: 'campaign',
        event_type: 'poll',
        payload: {
          channels_polled: sprint.active_channels,
          all_halted: allChannelsHalted,
        },
      });

      if (allChannelsHalted) {
        // All channels hit 48h or budget — dispatch VerdictAgent
        const updated = await dispatchVerdict(sprint.id);

        await db.from('sprint_events').insert({
          sprint_id: sprint.id,
          agent: 'verdict',
          event_type: updated.state === 'BLOCKED' ? 'blocked' : 'completed',
          payload: {
            verdict: updated.verdict?.verdict,
            confidence: updated.verdict?.confidence,
            channel_verdicts: updated.verdict?.channel_verdicts,
          },
        });

        results.push({ sprint_id: sprint.id, action: 'verdict_dispatched', state: updated.state });
      } else {
        results.push({ sprint_id: sprint.id, action: 'polled', state: 'CAMPAIGN_MONITORING' });
      }
    } catch (err) {
      console.error(`[sprint-monitor] Sprint ${sprint.id} error:`, err);
      results.push({ sprint_id: sprint.id, action: 'error', state: 'BLOCKED' });
    }
  }

  return Response.json({
    message: 'Sprint monitor cron executed',
    polled: sprints.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
