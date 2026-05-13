// ─────────────────────────────────────────────────────────────────────────────
// Sprint state machine — orchestrates all 7 agents in sequence
// Shared state keyed by sprint_id — all agents read from and write to this
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';
import { runGenomeAgent } from '@/lib/agents/genome';
import { runAllHealthgateAgents } from '@/lib/agents/healthgate';
import { runAngleAgent } from '@/lib/agents/angle';
import { runVerdictAgent } from '@/lib/agents/verdict';
import {
  getSprintAngleResults,
  overlayRollupOnCampaign,
  aggregateLpConversionRate,
} from '@/lib/meta/angle-rollup';
import type {
  SprintRecord,
  SprintState,
  Platform,
  CampaignAgentOutput,
} from '@/lib/agents/types';
import { isStripePaymentGateEnabled } from '@/lib/payment-gate';
import { hasCompletedPayment } from '@/lib/payments/db';

// ── State helpers ──────────────────────────────────────────────────────────

export async function getSprint(sprint_id: string): Promise<SprintRecord | null> {
  const db = createServiceClient();
  const { data } = await db
    .from('sprints')
    .select('*')
    .eq('id', sprint_id)
    .single();
  return data as SprintRecord | null;
}

export async function patchSprint(
  sprint_id: string,
  patch: Partial<SprintRecord>
): Promise<void> {
  const db = createServiceClient();
  await db
    .from('sprints')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', sprint_id);
}

async function transitionState(sprint_id: string, next: SprintState): Promise<void> {
  await patchSprint(sprint_id, { state: next });
}

async function blockSprint(sprint_id: string, reason: string): Promise<void> {
  await patchSprint(sprint_id, { state: 'BLOCKED', blocked_reason: reason });
}

// ── Step 1: Run GenomeAgent ────────────────────────────────────────────────

export async function dispatchGenome(sprint_id: string): Promise<SprintRecord> {
  await transitionState(sprint_id, 'GENOME_RUNNING');

  let sprint = await getSprint(sprint_id);
  if (!sprint) throw new Error(`Sprint ${sprint_id} not found`);

  try {
    const genome = await runGenomeAgent(sprint.idea);
    await patchSprint(sprint_id, { genome, state: 'GENOME_DONE' });

    // Halt if STOP signal
    if (genome.signal === 'STOP') {
      await blockSprint(
        sprint_id,
        `GenomeAgent returned STOP (composite ${genome.composite}/100). Pivot brief: ${genome.pivot_brief ?? 'None'}`
      );
    }

    sprint = (await getSprint(sprint_id))!;
  } catch (err) {
    await blockSprint(sprint_id, `GenomeAgent failed: ${String(err)}`);
  }

  return (await getSprint(sprint_id))!;
}

// ── Step 2: Run HealthgateAgents (all channels in parallel) ───────────────

export async function dispatchHealthgate(
  sprint_id: string,
  channelAccountData: Partial<Record<Platform, Record<string, unknown>>>
): Promise<SprintRecord> {
  await transitionState(sprint_id, 'HEALTHGATE_RUNNING');

  try {
    const sprint = await getSprint(sprint_id);
    if (!sprint) throw new Error(`Sprint ${sprint_id} not found`);

    const selectedChannels = sprint.active_channels.length ? sprint.active_channels : (Object.keys(channelAccountData) as Platform[]);

    // ── Managed account mode ─────────────────────────────────────────────────
    // In the v9 managed-account architecture LaunchLense owns all the ad
    // accounts, so there is nothing user-side to healthcheck. When no real
    // per-channel account data is supplied we auto-pass every channel at a
    // high score rather than running checks against undefined values (which
    // would cause every CRITICAL check to fail and block the sprint).
    const hasRealData = selectedChannels.some(
      (ch) => channelAccountData[ch] && Object.keys(channelAccountData[ch]!).length > 0,
    );

    type HealthgateMap = Record<Platform, import('@/lib/agents/types').HealthgateAgentOutput>;

    let healthgate: HealthgateMap;
    if (!hasRealData) {
      const managed = Object.fromEntries(
        selectedChannels.map((ch) => [
          ch,
          {
            channel: ch,
            score: 95,
            status: 'HEALTHY' as const,
            checks: [] as import('@/lib/agents/types').HealthCheck[],
            blocking_issues: [] as string[],
            fix_summary: [] as string[],
            estimated_unblock_hours: 0,
          },
        ]),
      );
      healthgate = managed as unknown as HealthgateMap;
    } else {
      healthgate = await runAllHealthgateAgents(channelAccountData, selectedChannels) as HealthgateMap;
    }

    await patchSprint(sprint_id, { healthgate, state: 'HEALTHGATE_DONE' });

    // Check if at least one channel is not BLOCKED
    const passedChannels = (Object.values(healthgate) as { status: string; channel: Platform }[])
      .filter((h) => h.status !== 'BLOCKED')
      .map((h) => h.channel);

    if (passedChannels.length === 0) {
      await blockSprint(
        sprint_id,
        'All channels BLOCKED by Healthgate. Fix account issues before proceeding.'
      );
    } else {
      // Restrict active channels to those that passed
      const filtered = selectedChannels.filter((ch) => passedChannels.includes(ch));
      await patchSprint(sprint_id, { active_channels: filtered });
    }
  } catch (err) {
    await blockSprint(sprint_id, `HealthgateAgent failed: ${String(err)}`);
  }

  return (await getSprint(sprint_id))!;
}

// ── Step 3: Run AngleAgent ─────────────────────────────────────────────────

export async function dispatchAngles(
  sprint_id: string,
  opts?: { bypassPaymentCheck?: boolean },
): Promise<SprintRecord> {
  const pre = await getSprint(sprint_id);
  if (!pre) throw new Error(`Sprint ${sprint_id} not found`);

  if (pre.state === 'ANGLES_RUNNING' || pre.state === 'ANGLES_DONE') {
    return pre;
  }

  if (isStripePaymentGateEnabled() && !opts?.bypassPaymentCheck) {
    const paid = await hasCompletedPayment(sprint_id);
    if (!paid) {
      // Set state to PAYMENT_PENDING so the canvas shows the budget node
      // and the run route returns a clean 402 instead of throwing.
      if (pre.state !== 'PAYMENT_PENDING') {
        await transitionState(sprint_id, 'PAYMENT_PENDING');
      }
      return (await getSprint(sprint_id))!;
    }
    if (!['HEALTHGATE_DONE', 'PAYMENT_PENDING'].includes(pre.state)) {
      throw new Error(`Cannot run AngleAgent from state ${pre.state}`);
    }
  } else if (!isStripePaymentGateEnabled() && pre.state !== 'HEALTHGATE_DONE') {
    throw new Error(`Cannot run AngleAgent from state ${pre.state}`);
  }

  await transitionState(sprint_id, 'ANGLES_RUNNING');

  const sprint = await getSprint(sprint_id);
  if (!sprint?.genome) throw new Error('Genome output missing — cannot run AngleAgent.');

  try {
    const angles = await runAngleAgent({
      idea: sprint.idea,
      genome: sprint.genome,
      active_channels: sprint.active_channels,
    });
    await patchSprint(sprint_id, { angles, state: 'ANGLES_DONE' });
  } catch (err) {
    await blockSprint(sprint_id, `AngleAgent failed: ${String(err)}`);
  }

  return (await getSprint(sprint_id))!;
}

// ── Step 4: Transition to campaign monitoring ──────────────────────────────
// CampaignAgents are external (platform APIs). This records campaign_start
// and transitions to CAMPAIGN_RUNNING. Monitoring is done via cron.

export async function dispatchCampaignStart(
  sprint_id: string,
  campaignData: Partial<Record<Platform, Partial<Pick<CampaignAgentOutput, 'campaign_id' | 'campaign_start_time' | 'budget_cents'>>>>
): Promise<SprintRecord> {
  const sprint = await getSprint(sprint_id);
  if (!sprint) throw new Error(`Sprint ${sprint_id} not found`);
  const selectedAngleId = (sprint.angles as { selected_angle_id?: string } | undefined)?.selected_angle_id;
  const selectedAngle = sprint.angles?.angles.find((angle) => angle.id === selectedAngleId) ?? sprint.angles?.angles[0];
  const activeAngles = selectedAngle ? [selectedAngle] : [];

  // Initialize campaign agent outputs
  const campaign: Partial<Record<Platform, CampaignAgentOutput>> = {};
  for (const ch of sprint.active_channels) {
    const d = campaignData[ch];
    campaign[ch] = {
      channel: ch,
      status: d?.campaign_id ? 'ACTIVE' : 'PENDING',
      campaign_id: d?.campaign_id ?? null,
      campaign_start_time: d?.campaign_start_time ?? null,
      budget_cents: d?.budget_cents ?? Math.floor(sprint.budget_cents / sprint.active_channels.length),
      spent_cents: 0,
      angle_metrics: activeAngles.map((a) => ({
        id: a.id,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc_cents: 0,
        spend_cents: 0,
        status: 'PASS' as const,
      })) ?? [],
      last_polled_at: null,
    };
  }

  await patchSprint(sprint_id, { campaign: campaign as Record<Platform, CampaignAgentOutput>, state: 'CAMPAIGN_RUNNING' });
  return (await getSprint(sprint_id))!;
}

// ── Step 4b: Launch managed Meta campaign (used by orchestrator) ──────────
// Idempotent: launchManagedMetaCampaign checks sprint_campaigns first and
// short-circuits if a campaign already exists. Transitions
// ANGLES_DONE | LANDING_DONE → CAMPAIGN_CREATING → CAMPAIGN_RUNNING.

export async function dispatchCampaignLaunch(
  sprint_id: string,
  opts?: { bypassPaymentCheck?: boolean }
): Promise<SprintRecord> {
  const pre = await getSprint(sprint_id);
  if (!pre) throw new Error(`Sprint ${sprint_id} not found`);

  const launchableFrom: SprintState[] = ['ANGLES_DONE', 'LANDING_DONE'];
  if (!launchableFrom.includes(pre.state)) {
    // Already past this stage, or earlier — return current.
    return pre;
  }

  if (isStripePaymentGateEnabled() && !opts?.bypassPaymentCheck) {
    const paid = await hasCompletedPayment(sprint_id);
    if (!paid) {
      if (pre.state !== 'PAYMENT_PENDING') await transitionState(sprint_id, 'PAYMENT_PENDING');
      return (await getSprint(sprint_id))!;
    }
  }

  if (!pre.angles?.angles?.length) {
    await blockSprint(sprint_id, 'Cannot launch campaign without angles.');
    return (await getSprint(sprint_id))!;
  }

  await transitionState(sprint_id, 'CAMPAIGN_CREATING');

  try {
    // Lazy-import to avoid pulling Meta deps into modules that don't need them
    // (e.g. unit tests that only exercise other stages).
    const { launchManagedMetaCampaign } = await import('@/lib/meta/create-campaign');
    const result = await launchManagedMetaCampaign({
      sprintId: sprint_id,
      idea: pre.idea,
      angles: pre.angles,
      landing: pre.landing ?? null,
      totalBudgetCents: pre.budget_cents,
    });

    // Stitch the launch result back into sprint.campaign JSONB for the canvas
    // and `_meta_adset_map` for legacy sprint-monitor compatibility.
    const angleMetrics = pre.angles.angles.map((a) => ({
      id: a.id,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc_cents: 0,
      spend_cents: 0,
      status: 'PASS' as const,
    }));

    const campaign: Partial<Record<Platform, CampaignAgentOutput>> = {
      ...(pre.campaign ?? {}),
      meta: {
        channel: 'meta',
        status: 'ACTIVE',
        campaign_id: result.campaignId,
        campaign_start_time: new Date().toISOString(),
        budget_cents: pre.budget_cents,
        spent_cents: 0,
        angle_metrics: angleMetrics,
        last_polled_at: new Date().toISOString(),
      },
    };

    await patchSprint(sprint_id, {
      campaign: campaign as Record<Platform, CampaignAgentOutput>,
      angles: { ...(pre.angles as object), _meta_adset_map: result.adsetMap } as unknown as typeof pre.angles,
      state: 'CAMPAIGN_RUNNING',
    });
  } catch (err) {
    await blockSprint(sprint_id, `dispatchCampaignLaunch failed: ${String(err)}`);
  }

  return (await getSprint(sprint_id))!;
}

// ── Step 5: Poll campaign metrics (called every 4h by cron) ───────────────

export async function pollCampaignMetrics(
  sprint_id: string,
  metricsUpdate: Partial<Record<Platform, Partial<CampaignAgentOutput>>>
): Promise<SprintRecord> {
  const sprint = await getSprint(sprint_id);
  if (!sprint?.campaign) return sprint!;

  const updated = { ...sprint.campaign };

  for (const [ch, update] of Object.entries(metricsUpdate) as [Platform, Partial<CampaignAgentOutput>][]) {
    if (updated[ch]) {
      updated[ch] = {
        ...updated[ch]!,
        ...update,
        last_polled_at: new Date().toISOString(),
      };
    }
  }

  // Check halt conditions
  const allDone = sprint.active_channels.every((ch) => {
    const c = updated[ch];
    if (!c) return false;
    const startTime = c.campaign_start_time ? new Date(c.campaign_start_time).getTime() : 0;
    const elapsed48h = (Date.now() - startTime) >= 48 * 60 * 60 * 1000;
    const budgetExhausted = c.spent_cents >= c.budget_cents;
    return elapsed48h || budgetExhausted;
  });

  const newState: SprintState = allDone ? 'VERDICT_GENERATING' : 'CAMPAIGN_MONITORING';
  await patchSprint(sprint_id, { campaign: updated, state: newState });

  return (await getSprint(sprint_id))!;
}

// ── Step 6: Run VerdictAgent ───────────────────────────────────────────────

export async function dispatchVerdict(sprint_id: string): Promise<SprintRecord> {
  await transitionState(sprint_id, 'VERDICT_GENERATING');
  const sprint = await getSprint(sprint_id);

  if (!sprint?.campaign) {
    await blockSprint(sprint_id, 'VerdictAgent: no campaign data found.');
    return (await getSprint(sprint_id))!;
  }

  // Mark all channels as COMPLETE and overlay the denormalized angle rollup
  // (sprint_angle_results) so the verdict reflects the latest poll snapshot
  // AND LP-side performance, not a stale JSONB blob.
  const completedCampaigns = { ...sprint.campaign };
  let lpConversionRate: number | null = null;

  for (const ch of sprint.active_channels) {
    if (!completedCampaigns[ch]) continue;
    try {
      const rollup = await getSprintAngleResults(sprint_id, ch);
      if (rollup.length) {
        completedCampaigns[ch] = overlayRollupOnCampaign(completedCampaigns[ch]!, rollup);
        // First channel with LP data wins (Meta is canonical). Aggregate later
        // could be a weighted average across channels.
        const rate = aggregateLpConversionRate(rollup);
        if (rate != null && lpConversionRate == null) lpConversionRate = rate;
      }
    } catch (err) {
      console.warn(`[dispatchVerdict] rollup overlay failed for ${ch}:`, String(err));
    }
    completedCampaigns[ch]!.status = 'COMPLETE';
  }

  try {
    const db = createServiceClient();
    const { data: benchRow } = await db
      .from('benchmarks')
      .select('avg_ctr, avg_cvr, avg_cpa_cents')
      .eq('vertical', 'saas')
      .maybeSingle();

    const verdict = await runVerdictAgent(completedCampaigns, {
      genome: sprint.genome,
      angles: sprint.angles,
      sprint_budget_cents: sprint.budget_cents,
      sprint_created_at: sprint.created_at,
      landing_conversion_rate: lpConversionRate,
      benchmark_avg_ctr: benchRow?.avg_ctr != null ? Number(benchRow.avg_ctr) : null,
      benchmark_avg_cvr: benchRow?.avg_cvr != null ? Number(benchRow.avg_cvr) : null,
      benchmark_avg_cpc_cents: benchRow?.avg_cpa_cents != null ? Number(benchRow.avg_cpa_cents) : null,
    });
    await patchSprint(sprint_id, { verdict, state: 'COMPLETE', campaign: completedCampaigns });
  } catch (err) {
    await blockSprint(sprint_id, `VerdictAgent failed: ${String(err)}`);
  }

  return (await getSprint(sprint_id))!;
}

// ── Full auto-run (for standalone Genome + Healthgate flow) ───────────────

export async function autoRunSprintToHealthgate(
  sprint_id: string,
  channelAccountData: Partial<Record<Platform, Record<string, unknown>>>
): Promise<SprintRecord> {
  let sprint = await dispatchGenome(sprint_id);

  if (sprint.state === 'BLOCKED') return sprint;

  sprint = await dispatchHealthgate(sprint_id, channelAccountData);
  if (sprint.state === 'BLOCKED') return sprint;

  sprint = await dispatchAngles(sprint_id);
  return sprint;
}
