// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Server-side sprint orchestrator
//
// This is the single source of truth for pipeline progression. It is:
//   - Resumable: starts from current sprint state, skips already-completed stages
//   - Fault-tolerant: each stage catches its own errors and writes BLOCKED
//   - Observable: writes sprint_events for every transition
//   - Idempotent: safe to call multiple times on the same sprint
//
// Pipeline: IDLE → Genome → Healthgate → Angles → (manual campaign launch)
// Campaign monitoring and verdict dispatch are handled by /api/cron/sprint-monitor
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';
import { dispatchGenome, dispatchHealthgate, dispatchAngles, getSprint } from '@/lib/sprint-machine';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';
import type { SprintRecord, SprintState, Platform } from '@/lib/agents/types';

export interface OrchestratorOptions {
  /** Pass Healthgate account data if available; runs mock checks if omitted */
  channelData?: Partial<Record<Platform, Record<string, unknown>>>;
  /** Set true to bypass Stripe payment check during testing */
  bypassPaymentCheck?: boolean;
  /** Clerk userId for audit logging */
  userId?: string;
}

export interface OrchestratorResult {
  sprint_id: string;
  final_state: SprintState;
  stages_run: string[];
  blocked_reason?: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function logEvent(
  sprint_id: string,
  agent: string,
  event_type: string,
  payload: Record<string, unknown>
): Promise<void> {
  const db = createServiceClient();
  await db.from('sprint_events').insert({ sprint_id, agent, event_type, payload }).then(({ error }) => {
    if (error) console.warn(`[orchestrator] sprint_events insert failed: ${error.message}`);
  });
}

// ── Stage runners ─────────────────────────────────────────────────────────

async function runGenomeStage(sprint_id: string): Promise<SprintRecord> {
  await logEvent(sprint_id, 'genome', 'started', {});
  const updated = await dispatchGenome(sprint_id);

  await logEvent(sprint_id, 'genome', updated.state === 'BLOCKED' ? 'blocked' : 'completed', {
    signal: updated.genome?.signal,
    composite: updated.genome?.composite,
    data_source: updated.genome?.data_source,
    elapsed_ms: updated.genome?.elapsed_ms,
    blocked_reason: updated.blocked_reason,
  });

  if (updated.genome) {
    await emitSprintEvent(sprint_id, SprintEventName.GenomeCompleted, {
      composite_score: updated.genome.composite,
      signal: updated.genome.signal,
      data_source: updated.genome.data_source,
      elapsed_ms: updated.genome.elapsed_ms,
    });
  }

  return updated;
}

async function runHealthgateStage(
  sprint_id: string,
  channelData: Partial<Record<Platform, Record<string, unknown>>>
): Promise<SprintRecord> {
  await logEvent(sprint_id, 'healthgate', 'started', { channels: Object.keys(channelData) });
  const updated = await dispatchHealthgate(sprint_id, channelData);

  const hg = updated.healthgate;
  const channelSummary = hg
    ? Object.entries(hg).map(([ch, h]) => ({ channel: ch, status: h.status, score: h.score }))
    : [];

  await logEvent(sprint_id, 'healthgate', updated.state === 'BLOCKED' ? 'blocked' : 'completed', {
    channels: channelSummary,
    blocked_reason: updated.blocked_reason,
  });

  await emitSprintEvent(sprint_id, SprintEventName.HealthgateCompleted, {
    channels_checked: channelSummary.map((c) => c.channel),
    channels_passed: channelSummary.filter((c) => c.status !== 'BLOCKED').map((c) => c.channel),
    channels_blocked: channelSummary.filter((c) => c.status === 'BLOCKED').map((c) => c.channel),
  });

  return updated;
}

async function runAnglesStage(
  sprint_id: string,
  opts?: { bypassPaymentCheck?: boolean }
): Promise<SprintRecord> {
  await logEvent(sprint_id, 'angle', 'started', {});
  const updated = await dispatchAngles(sprint_id, { bypassPaymentCheck: opts?.bypassPaymentCheck });

  await logEvent(sprint_id, 'angle', updated.state === 'BLOCKED' ? 'blocked' : 'completed', {
    angle_count: updated.angles?.angles?.length ?? 0,
    blocked_reason: updated.blocked_reason,
  });

  if (updated.angles) {
    await emitSprintEvent(sprint_id, SprintEventName.AnglesGenerated, {
      angle_count: updated.angles.angles.length,
      archetypes: updated.angles.angles.map((a) => a.archetype),
    });
  }

  return updated;
}

// ── Main pipeline runner ───────────────────────────────────────────────────

/**
 * Run exactly ONE pipeline stage based on the sprint's current state.
 * This is the Hobby-safe entry point — each call fits within the 10s limit.
 *
 * IDLE             → GenomeAgent
 * GENOME_DONE      → HealthgateAgent
 * HEALTHGATE_DONE  → AngleAgent
 * Anything else    → no-op, returns current state
 */
export async function runNextStage(
  sprint_id: string,
  currentState: SprintState,
  opts: OrchestratorOptions = {}
): Promise<OrchestratorResult> {
  const db = createServiceClient();

  try {
    if (currentState === 'IDLE') {
      const updated = await runGenomeStage(sprint_id);
      return {
        sprint_id,
        final_state: updated.state as SprintState,
        stages_run: ['genome'],
        blocked_reason: updated.blocked_reason ?? undefined,
      };
    }

    if (currentState === 'GENOME_DONE') {
      const updated = await runHealthgateStage(sprint_id, opts.channelData ?? {});
      return {
        sprint_id,
        final_state: updated.state as SprintState,
        stages_run: ['healthgate'],
        blocked_reason: updated.blocked_reason ?? undefined,
      };
    }

    if (currentState === 'HEALTHGATE_DONE') {
      const updated = await runAnglesStage(sprint_id, { bypassPaymentCheck: opts.bypassPaymentCheck });
      return {
        sprint_id,
        final_state: updated.state as SprintState,
        stages_run: ['angles'],
        blocked_reason: updated.blocked_reason ?? undefined,
      };
    }

    // No actionable stage for this state
    return { sprint_id, final_state: currentState, stages_run: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[orchestrator] runNextStage error for sprint ${sprint_id} (${currentState}):`, message);

    await db
      .from('sprints')
      .update({ state: 'BLOCKED', blocked_reason: `Stage error: ${message}`, updated_at: new Date().toISOString() })
      .eq('id', sprint_id);

    await logEvent(sprint_id, 'orchestrator', 'stage_failed', { state: currentState, error: message });

    return { sprint_id, final_state: 'BLOCKED', stages_run: [], error: message };
  }
}

/**
 * Run the full pipeline from current state (Pro/local use).
 * Stops at BLOCKED, PAYMENT_PENDING, or ANGLES_DONE.
 */
export async function runSprintPipeline(
  sprint_id: string,
  opts: OrchestratorOptions = {}
): Promise<OrchestratorResult> {
  const stagesRun: string[] = [];
  let sprint = await getSprint(sprint_id);

  if (!sprint) {
    return { sprint_id, final_state: 'BLOCKED', stages_run: [], error: 'Sprint not found' };
  }

  await logEvent(sprint_id, 'orchestrator', 'pipeline_started', {
    initial_state: sprint.state,
    user_id: opts.userId,
  });

  try {
    // ── GENOME ──────────────────────────────────────────────────────────
    if (sprint.state === 'IDLE') {
      sprint = await runGenomeStage(sprint_id);
      stagesRun.push('genome');
      if (sprint.state === 'BLOCKED') {
        return { sprint_id, final_state: 'BLOCKED', stages_run: stagesRun, blocked_reason: sprint.blocked_reason ?? undefined };
      }
    }

    // ── HEALTHGATE ───────────────────────────────────────────────────────
    if (sprint.state === 'GENOME_DONE') {
      const channelData = opts.channelData ?? {};
      sprint = await runHealthgateStage(sprint_id, channelData);
      stagesRun.push('healthgate');
      if (sprint.state === 'BLOCKED') {
        return { sprint_id, final_state: 'BLOCKED', stages_run: stagesRun, blocked_reason: sprint.blocked_reason ?? undefined };
      }
    }

    // ── PAYMENT CHECK (stop here if gate is enabled and payment not done) ─
    if (sprint.state === 'PAYMENT_PENDING') {
      await logEvent(sprint_id, 'orchestrator', 'paused', { reason: 'PAYMENT_PENDING' });
      return { sprint_id, final_state: 'PAYMENT_PENDING', stages_run: stagesRun };
    }

    // ── ANGLES ───────────────────────────────────────────────────────────
    if (sprint.state === 'HEALTHGATE_DONE') {
      sprint = await runAnglesStage(sprint_id, { bypassPaymentCheck: opts.bypassPaymentCheck });
      stagesRun.push('angles');
      if (sprint.state === 'BLOCKED') {
        return { sprint_id, final_state: 'BLOCKED', stages_run: stagesRun, blocked_reason: sprint.blocked_reason ?? undefined };
      }
    }

    // Pipeline reaches ANGLES_DONE — campaign launch is a manual user action
    await logEvent(sprint_id, 'orchestrator', 'pipeline_completed', {
      final_state: sprint.state,
      stages_run: stagesRun,
    });

    return { sprint_id, final_state: sprint.state as SprintState, stages_run: stagesRun };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[orchestrator] Sprint ${sprint_id} pipeline error:`, message);

    const db = createServiceClient();
    await db
      .from('sprints')
      .update({ state: 'BLOCKED', blocked_reason: `Orchestrator error: ${message}`, updated_at: new Date().toISOString() })
      .eq('id', sprint_id);

    await logEvent(sprint_id, 'orchestrator', 'pipeline_failed', { error: message, stages_run: stagesRun });

    return { sprint_id, final_state: 'BLOCKED', stages_run: stagesRun, error: message };
  }
}
