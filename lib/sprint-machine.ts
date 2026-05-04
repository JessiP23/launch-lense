// ─────────────────────────────────────────────────────────────────────────────
// Sprint state machine — orchestrates all 7 agents in sequence
// Shared state keyed by sprint_id — all agents read from and write to this
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';
import { runGenomeAgent } from '@/lib/agents/genome';
import { runAllHealthgateAgents } from '@/lib/agents/healthgate';
import { runAngleAgent } from '@/lib/agents/angle';
import { runVerdictAgent } from '@/lib/agents/verdict';
import type {
  SprintRecord,
  SprintState,
  Platform,
  CampaignAgentOutput,
} from '@/lib/agents/types';

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
    const healthgate = await runAllHealthgateAgents(channelAccountData, selectedChannels);
    await patchSprint(sprint_id, { healthgate, state: 'HEALTHGATE_DONE' });

    // Check if at least one channel is not BLOCKED
    const passedChannels = (Object.values(healthgate) as ReturnType<typeof Object.values>)
      .filter((h: { status: string }) => h.status !== 'BLOCKED')
      .map((h: { channel: Platform }) => h.channel) as Platform[];

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

export async function dispatchAngles(sprint_id: string): Promise<SprintRecord> {
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

  // Mark all channels as COMPLETE for verdict
  const completedCampaigns = { ...sprint.campaign };
  for (const ch of sprint.active_channels) {
    if (completedCampaigns[ch]) {
      completedCampaigns[ch]!.status = 'COMPLETE';
    }
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
      landing_conversion_rate: null,
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
