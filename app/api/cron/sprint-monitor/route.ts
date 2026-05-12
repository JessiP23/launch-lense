// GET /api/cron/sprint-monitor
// Runs every 4 hours via Vercel Cron (see vercel.json).
// Authorization: Bearer ${CRON_SECRET}
//
// Responsibilities per active sprint:
//   1. Fetch per-angle adset insights from Meta Marketing API
//   2. Update campaign metrics in sprint.campaign JSONB
//   3. Pause underperforming angles (CTR < 0.3% after 500 impressions)
//   4. Detect halt conditions (48h elapsed OR budget exhausted)
//   5. Dispatch VerdictAgent when halted
//   6. Emit PostHog analytics events

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import {
  fetchAndEvaluateAngles,
  getSystemToken,
  getSystemAdAccountId,
} from '@/lib/meta-api';
import { dispatchVerdict } from '@/lib/sprint-machine';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';
import type { Platform, CampaignAgentOutput, AngleMetrics, AngleStatus } from '@/lib/agents/types';

const SANDBOX_MODE = process.env.ADS_API_MODE === 'sandbox';
const CAMPAIGN_DURATION_HOURS = 48;
const MAX_SPRINTS_PER_RUN = 20;

// ── Sandbox metrics simulation ─────────────────────────────────────────────

function simulateSandboxMetrics(
  metrics: AngleMetrics[],
  elapsedHours: number
): AngleMetrics[] {
  return metrics.map((m, i) => {
    // Simulate slight variation across angles
    const multiplier = i === 0 ? 1.2 : i === 1 ? 0.9 : 0.6;
    const progressPct = Math.min(1, elapsedHours / CAMPAIGN_DURATION_HOURS);
    const impressions = Math.floor(1200 * multiplier * progressPct);
    const clicks = Math.floor(impressions * 0.012 * multiplier);
    const spend_cents = Math.floor(5000 * multiplier * progressPct);

    return {
      ...m,
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpc_cents: clicks > 0 ? Math.floor(spend_cents / clicks) : 0,
      spend_cents,
      status: (impressions >= 500 && clicks / Math.max(impressions, 1) < 0.003 ? 'FAIL' : 'PASS') as AngleStatus,
    };
  });
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const db = createServiceClient();

  // 1. Find all active campaign sprints
  const { data: sprints, error } = await db
    .from('sprints')
    .select('*')
    .in('state', ['CAMPAIGN_RUNNING', 'CAMPAIGN_MONITORING'])
    .order('created_at', { ascending: true })
    .limit(MAX_SPRINTS_PER_RUN);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!sprints?.length) return Response.json({ message: 'No active campaigns', polled: 0 });

  const results: Array<{
    sprint_id: string;
    action: 'polled' | 'paused_angles' | 'verdict_dispatched' | 'error';
    angles_paused?: string[];
    state: string;
    error?: string;
  }> = [];

  // Resolve system token once — fail fast if not configured in production
  let systemToken: string | null = null;
  if (!SANDBOX_MODE) {
    try {
      systemToken = getSystemToken();
      getSystemAdAccountId(); // validate
    } catch (err) {
      console.error('[sprint-monitor] System token not configured:', err);
      return Response.json({ error: 'SYSTEM_META_ACCESS_TOKEN not configured' }, { status: 503 });
    }
  }

  for (const sprint of sprints) {
    try {
      const campaign = sprint.campaign as Record<Platform, CampaignAgentOutput> | null;
      if (!campaign?.meta?.campaign_id && !SANDBOX_MODE) {
        // No Meta campaign yet — skip
        results.push({ sprint_id: sprint.id, action: 'polled', state: sprint.state });
        continue;
      }

      const startTime = campaign?.meta?.campaign_start_time
        ? new Date(campaign.meta.campaign_start_time).getTime()
        : 0;
      const elapsedHours = startTime > 0 ? (Date.now() - startTime) / 3_600_000 : 0;
      const elapsed48h = elapsedHours >= CAMPAIGN_DURATION_HOURS;

      let updatedMetrics: AngleMetrics[] = campaign?.meta?.angle_metrics ?? [];
      let totalSpent = campaign?.meta?.spent_cents ?? 0;
      const pausedAngles: string[] = [];

      // 2. Fetch real or simulated metrics
      if (SANDBOX_MODE) {
        updatedMetrics = simulateSandboxMetrics(updatedMetrics, elapsedHours);
        totalSpent = updatedMetrics.reduce((s, m) => s + m.spend_cents, 0);
      } else {
        // Get adset map stored during campaign creation
        const adsetMap = ((sprint.angles as Record<string, unknown>)?._meta_adset_map ?? {}) as Record<string, string>;
        const angleAdsetMap = {
          angle_A: adsetMap.angle_A,
          angle_B: adsetMap.angle_B,
          angle_C: adsetMap.angle_C,
        } as Record<'angle_A' | 'angle_B' | 'angle_C', string>;

        // Filter to angles that have adset IDs
        const validMap = Object.fromEntries(
          Object.entries(angleAdsetMap).filter(([, v]) => !!v)
        ) as Record<'angle_A' | 'angle_B' | 'angle_C', string>;

        if (Object.keys(validMap).length > 0) {
          const liveMetrics = await fetchAndEvaluateAngles(validMap, systemToken!, true);

          updatedMetrics = updatedMetrics.map((m) => {
            const live = liveMetrics.find((l) => l.angle_id === m.id);
            if (!live) return m;
            if (live.status === 'UNDERPERFORM') pausedAngles.push(m.id);
            return {
              ...m,
              impressions: live.impressions,
              clicks: live.clicks,
              ctr: live.ctr,
              cpc_cents: live.cpc_cents,
              spend_cents: live.spend_cents,
              status: live.status === 'UNDERPERFORM' ? 'FAIL' : m.status,
            };
          });
          totalSpent = updatedMetrics.reduce((s, m) => s + m.spend_cents, 0);
        }
      }

      const budgetExhausted = totalSpent >= (campaign?.meta?.budget_cents ?? Infinity);
      const allHalted = elapsed48h || budgetExhausted;

      // 3. Persist updated metrics
      const updatedCampaign: Record<Platform, CampaignAgentOutput> = {
        ...campaign,
        meta: {
          ...campaign!.meta,
          spent_cents: totalSpent,
          angle_metrics: updatedMetrics,
          last_polled_at: new Date().toISOString(),
          status: allHalted ? 'COMPLETE' : 'ACTIVE',
        },
      } as Record<Platform, CampaignAgentOutput>;

      await db
        .from('sprints')
        .update({
          campaign: updatedCampaign,
          state: allHalted ? 'CAMPAIGN_MONITORING' : sprint.state,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sprint.id);

      // 4. Emit poll event
      await db.from('sprint_events').insert({
        sprint_id: sprint.id,
        agent: 'campaign',
        event_type: 'poll',
        payload: {
          elapsed_hours: Math.round(elapsedHours * 10) / 10,
          total_spent_cents: totalSpent,
          channels_polled: sprint.active_channels,
          all_halted: allHalted,
          paused_angles: pausedAngles,
          sandbox: SANDBOX_MODE,
        },
      });

      await emitSprintEvent(sprint.id, SprintEventName.CampaignPolled, {
        channels: sprint.active_channels,
        all_halted: allHalted,
      });

      // 5. Dispatch verdict when done
      if (allHalted) {
        const updated = await dispatchVerdict(sprint.id);

        await db.from('sprint_events').insert({
          sprint_id: sprint.id,
          agent: 'verdict',
          event_type: updated.state === 'BLOCKED' ? 'blocked' : 'completed',
          payload: {
            verdict: updated.verdict?.verdict,
            confidence: updated.verdict?.confidence,
            market_signal_strength: updated.verdict?.demand_validation?.scores?.market_signal_strength,
            channel_verdicts: updated.verdict?.channel_verdicts,
          },
        });

        if (updated.verdict) {
          await emitSprintEvent(sprint.id, SprintEventName.VerdictIssued, {
            verdict: updated.verdict.verdict,
            confidence: updated.verdict.confidence,
            market_signal_strength: updated.verdict.demand_validation?.scores?.market_signal_strength ?? 'WEAK',
            total_spend_cents: totalSpent,
            weighted_blended_ctr: updated.verdict.aggregate_metrics?.weighted_blended_ctr ?? 0,
            winning_angle: updated.verdict.cross_channel_winning_angle,
            recommended_channel: updated.verdict.recommended_channel,
          });
        }

        results.push({
          sprint_id: sprint.id,
          action: 'verdict_dispatched',
          angles_paused: pausedAngles,
          state: updated.state,
        });
      } else {
        results.push({
          sprint_id: sprint.id,
          action: pausedAngles.length > 0 ? 'paused_angles' : 'polled',
          angles_paused: pausedAngles,
          state: sprint.state,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sprint-monitor] Sprint ${sprint.id} error:`, message);
      results.push({ sprint_id: sprint.id, action: 'error', state: 'unknown', error: message });
    }
  }

  return Response.json({
    message: 'Sprint monitor executed',
    polled: sprints.length,
    sandbox: SANDBOX_MODE,
    results,
    timestamp: new Date().toISOString(),
  });
}
