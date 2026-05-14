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

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import {
  fetchAndEvaluateAngles,
  getSystemToken,
  getSystemAdAccountId,
  pauseAdset,
} from '@/lib/meta-api';
import { getExtendedAdsetInsights, evaluatePauseRules } from '@/lib/meta/insights';
import { withMetaRetry } from '@/lib/meta/retry';
import { refreshSprintAngleResults, pickWinningAngle, lpConversionsFor, aggregateLpEventsByAngle } from '@/lib/meta/angle-rollup';
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
        // Prefer the normalized sprint_campaigns.adset_map (managed launcher);
        // fall back to the legacy in-blob _meta_adset_map for older sprints.
        const { data: campaignRow } = await db
          .from('sprint_campaigns')
          .select('id, adset_map, campaign_id')
          .eq('sprint_id', sprint.id)
          .eq('channel', 'meta')
          .maybeSingle();

        let adsetMap = (campaignRow?.adset_map as Record<string, string> | undefined) ?? {};
        if (Object.keys(adsetMap).length === 0) {
          adsetMap = ((sprint.angles as Record<string, unknown>)?._meta_adset_map ?? {}) as Record<string, string>;
        }

        const validEntries = Object.entries(adsetMap).filter(([, v]) => !!v);

        if (validEntries.length > 0) {
          // Aggregate LP conversions per angle so the pause-rules engine has the
          // "no-conversion spend ceiling" signal it needs.
          const lpByAngle = await aggregateLpEventsByAngle(sprint.id);

          for (const [angleId, adsetId] of validEntries) {
            const insight = await getExtendedAdsetInsights(adsetId, systemToken!).catch((err) => {
              console.warn(`[sprint-monitor] insights failed adset=${adsetId}:`, String(err));
              return null;
            });
            if (!insight) continue;

            const lpConv = lpConversionsFor(lpByAngle.get(angleId));
            const decision = evaluatePauseRules(insight, lpConv);

            // Merge live insight back into the in-blob angle_metrics for canvas.
            updatedMetrics = updatedMetrics.map((m) =>
              m.id === angleId
                ? {
                    ...m,
                    impressions: insight.impressions,
                    clicks: insight.clicks,
                    ctr: insight.ctr,
                    cpc_cents: insight.cpc_cents,
                    spend_cents: insight.spend_cents,
                    status: decision.pause ? ('FAIL' as AngleStatus) : m.status,
                  }
                : m
            );

            // Snapshot per-angle metric row (append-only).
            await db.from('sprint_metrics').insert({
              sprint_id: sprint.id,
              sprint_campaign_id: campaignRow?.id ?? null,
              angle_id: angleId,
              channel: 'meta',
              impressions: insight.impressions,
              clicks: insight.clicks,
              ctr: insight.ctr,
              cpc_cents: insight.cpc_cents,
              cpm_cents: insight.cpm_cents,
              spend_cents: insight.spend_cents,
              frequency: insight.frequency,
              outbound_clicks: insight.outbound_clicks,
              leads: lpConv,
              raw: insight as unknown as Record<string, unknown>,
            });

            if (decision.pause) {
              try {
                await withMetaRetry(() => pauseAdset(adsetId, systemToken!), {
                  label: `pause-adset:${adsetId}`,
                });
                pausedAngles.push(angleId);
                await emitSprintEvent(sprint.id, SprintEventName.CampaignPaused, {
                  channel: 'meta',
                  campaign_id: campaignRow?.campaign_id ?? undefined,
                  adset_id: adsetId,
                  angle_id: angleId,
                  reason: decision.reason ?? 'thresholds',
                });
                await db.from('sprint_ads').update({ status: 'PAUSED', updated_at: new Date().toISOString() })
                  .eq('sprint_campaign_id', campaignRow?.id ?? '')
                  .eq('angle_id', angleId);
              } catch (err) {
                console.error(`[sprint-monitor] pauseAdset ${adsetId} failed:`, err);
              }
            }
          }

          totalSpent = updatedMetrics.reduce((s, m) => s + m.spend_cents, 0);

          // Refresh denormalized rollup + pick the current winner.
          const rollup = await refreshSprintAngleResults(sprint.id, 'meta');
          const winner = pickWinningAngle(rollup);
          if (winner) {
            const cvr = winner.lp_views > 0
              ? (winner.lp_form_submits + winner.lp_email_captures) / winner.lp_views
              : 0;
            await emitSprintEvent(sprint.id, SprintEventName.AngleWon, {
              channel: 'meta',
              angle_id: winner.angle_id,
              ctr: winner.ctr,
              cpc_cents: winner.cpc_cents,
              lp_conversion_rate: cvr,
            });
          }

          // Touch sprint_campaigns.last_polled_at for observability.
          if (campaignRow?.id) {
            await db
              .from('sprint_campaigns')
              .update({ last_polled_at: new Date().toISOString() })
              .eq('id', campaignRow.id);
          }
        } else {
          // No managed launcher record — fall back to legacy whole-campaign poll.
          // Kept for back-compat with sprints created before migration 008.
          const legacyMap = ((sprint.angles as Record<string, unknown>)?._meta_adset_map ?? {}) as Record<'angle_A' | 'angle_B' | 'angle_C', string>;
          if (Object.values(legacyMap).some(Boolean)) {
            const liveMetrics = await fetchAndEvaluateAngles(legacyMap, systemToken!, true);
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

      // 3b. Sandbox + legacy paths still need normalized sprint_metrics rows.
      // (Live managed path inserts these inline so it can capture extended
      //  fields like frequency, cpm_cents, outbound_clicks.)
      if (updatedMetrics.length > 0 && SANDBOX_MODE) {
        const { data: campaignRow } = await db
          .from('sprint_campaigns')
          .select('id')
          .eq('sprint_id', sprint.id)
          .eq('channel', 'meta')
          .maybeSingle();
        await db.from('sprint_metrics').insert(
          updatedMetrics.map((m) => ({
            sprint_id: sprint.id,
            sprint_campaign_id: campaignRow?.id ?? null,
            angle_id: m.id,
            channel: 'meta',
            impressions: m.impressions,
            clicks: m.clicks,
            ctr: m.ctr,
            cpc_cents: m.cpc_cents,
            spend_cents: m.spend_cents,
            raw: m as unknown as Record<string, unknown>,
          }))
        );
      }

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
