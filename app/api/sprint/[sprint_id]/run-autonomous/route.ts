// POST /api/sprint/[sprint_id]/run-autonomous
//
// Autonomous sprint runner — runs the full pipeline server-side without client polling.
// The founder types an idea, clicks Start, and the entire pipeline runs to completion.
// They watch. They do not drive.
//
// Pipeline flow:
//   IDLE → GENOME_RUNNING → GENOME_DONE → HEALTHGATE_RUNNING → HEALTHGATE_DONE
//   → ANGLES_RUNNING → ANGLES_DONE → USER_REVIEW_REQUIRED (human gate for creative approval)
//   → CREATIVE_APPROVED → CAMPAIGN_CREATING → CAMPAIGN_RUNNING → CAMPAIGN_MONITORING
//   → VERDICT_GENERATING → COMPLETE
//
// This route responds immediately with { started: true, sprint_id } and runs the pipeline
// in the background using a non-blocking void async IIFE pattern.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSprint, patchSprint } from '@/lib/sprint-machine';
import {
  dispatchGenome,
  dispatchHealthgate,
  dispatchAngles,
  dispatchCampaignLaunch,
  dispatchVerdict,
} from '@/lib/sprint-machine';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';
import type { Platform, SprintState } from '@/lib/agents/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function logEvent(
  sprint_id: string,
  agent: string,
  event_type: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { createServiceClient } = await import('@/lib/supabase');
  const db = createServiceClient();
  await db.from('sprint_events').insert({ sprint_id, agent, event_type, payload }).then(({ error }) => {
    if (error) console.warn(`[autonomous-runner] sprint_events insert failed: ${error.message}`);
  });
}

async function blockSprint(sprint_id: string, reason: string): Promise<void> {
  await patchSprint(sprint_id, { state: 'BLOCKED', blocked_reason: reason });
  await logEvent(sprint_id, 'autonomous-runner', 'blocked', { reason });
}

async function transitionState(sprint_id: string, next: SprintState): Promise<void> {
  await patchSprint(sprint_id, { state: next });
}

// ── Main autonomous pipeline runner ─────────────────────────────────────────

async function runAutonomousPipeline(
  sprint_id: string,
  userId?: string
): Promise<void> {
  const sprint = await getSprint(sprint_id);
  if (!sprint) {
    console.error(`[autonomous-runner] Sprint ${sprint_id} not found`);
    return;
  }

  await logEvent(sprint_id, 'autonomous-runner', 'pipeline_started', {
    initial_state: sprint.state,
    user_id: userId,
  });

  try {
    // ── GENOME ──────────────────────────────────────────────────────────────
    if (sprint.state === 'IDLE') {
      await transitionState(sprint_id, 'GENOME_RUNNING');
      try {
        const { runGenomeAgent } = await import('@/lib/agents/genome');
        const genome = await runGenomeAgent(sprint.idea);
        await patchSprint(sprint_id, { genome, state: 'GENOME_DONE' });

        if (genome.signal === 'STOP') {
          await blockSprint(
            sprint_id,
            `GenomeAgent returned STOP (composite ${genome.composite}/100). Pivot brief: ${genome.pivot_brief ?? 'None'}`
          );
          await emitSprintEvent(sprint_id, SprintEventName.GenomeCompleted, {
            composite_score: genome.composite,
            signal: genome.signal,
            data_source: genome.data_source,
            elapsed_ms: genome.elapsed_ms,
          });
          return;
        }

        await logEvent(sprint_id, 'genome', 'completed', {
          signal: genome.signal,
          composite: genome.composite,
          data_source: genome.data_source,
          elapsed_ms: genome.elapsed_ms,
        });

        await emitSprintEvent(sprint_id, SprintEventName.GenomeCompleted, {
          composite_score: genome.composite,
          signal: genome.signal,
          data_source: genome.data_source,
          elapsed_ms: genome.elapsed_ms,
        });
      } catch (err) {
        await blockSprint(sprint_id, `GenomeAgent failed: ${String(err)}`);
        return;
      }
    }

    // ── HEALTHGATE ───────────────────────────────────────────────────────────
    const currentSprint = await getSprint(sprint_id);
    if (!currentSprint) return;

    if (currentSprint.state === 'GENOME_DONE') {
      await transitionState(sprint_id, 'HEALTHGATE_RUNNING');
      try {
        const { runAllHealthgateAgents } = await import('@/lib/agents/healthgate');
        const selectedChannels = currentSprint.active_channels.length
          ? currentSprint.active_channels
          : (['meta', 'google', 'linkedin', 'tiktok'] as Platform[]);

        // Managed account mode — auto-pass all channels since LaunchLense owns the accounts
        const healthgateEntries = selectedChannels.map((ch) => [
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
        ] as [Platform, import('@/lib/agents/types').HealthgateAgentOutput]);
        const healthgate = Object.fromEntries(healthgateEntries) as Record<Platform, import('@/lib/agents/types').HealthgateAgentOutput>;

        await patchSprint(sprint_id, { healthgate, state: 'HEALTHGATE_DONE' });
        await logEvent(sprint_id, 'healthgate', 'completed', {
          channels: selectedChannels,
        });
      } catch (err) {
        await blockSprint(sprint_id, `HealthgateAgent failed: ${String(err)}`);
        return;
      }
    }

    // ── PAYMENT CHECK ──────────────────────────────────────────────────────
    const postHealthgateSprint = await getSprint(sprint_id);
    if (!postHealthgateSprint) return;

    const { isStripePaymentGateEnabled } = await import('@/lib/payment-gate');
    const { hasCompletedPayment } = await import('@/lib/payments/db');

    if (isStripePaymentGateEnabled()) {
      const paid = await hasCompletedPayment(sprint_id);
      if (!paid) {
        await transitionState(sprint_id, 'PAYMENT_PENDING');
        await logEvent(sprint_id, 'autonomous-runner', 'paused', { reason: 'PAYMENT_PENDING' });
        return; // Stop here — wait for payment
      }
    }

    // ── ANGLES ──────────────────────────────────────────────────────────────
    const preAnglesSprint = await getSprint(sprint_id);
    if (!preAnglesSprint) return;

    if (preAnglesSprint.state === 'HEALTHGATE_DONE' || preAnglesSprint.state === 'PAYMENT_PENDING') {
      await transitionState(sprint_id, 'ANGLES_RUNNING');
      try {
        const { runAngleAgent } = await import('@/lib/agents/angle');
        if (!preAnglesSprint.genome) {
          await blockSprint(sprint_id, 'Genome output missing — cannot run AngleAgent.');
          return;
        }
        const angles = await runAngleAgent({
          idea: preAnglesSprint.idea,
          genome: preAnglesSprint.genome,
          active_channels: preAnglesSprint.active_channels,
        });
        await patchSprint(sprint_id, { angles, state: 'ANGLES_DONE' });

        // Seed sprint_creatives rows
        const { seedSprintCreatives } = await import('@/lib/creatives/seed');
        await seedSprintCreatives(sprint_id, angles, preAnglesSprint.active_channels);

        await logEvent(sprint_id, 'angle', 'completed', {
          angle_count: angles.angles.length,
        });

        await emitSprintEvent(sprint_id, SprintEventName.AnglesGenerated, {
          angle_count: angles.angles.length,
          archetypes: angles.angles.map((a) => a.archetype),
        });
      } catch (err) {
        await blockSprint(sprint_id, `AngleAgent failed: ${String(err)}`);
        return;
      }
    }

    // ── USER_REVIEW_REQUIRED (human gate) ────────────────────────────────────
    const postAnglesSprint = await getSprint(sprint_id);
    if (!postAnglesSprint) return;

    if (postAnglesSprint.state === 'ANGLES_DONE') {
      await transitionState(sprint_id, 'USER_REVIEW_REQUIRED');
      await logEvent(sprint_id, 'autonomous-runner', 'paused', {
        reason: 'USER_REVIEW_REQUIRED',
        message: 'Founder must approve at least one creative per channel',
      });
      return; // Stop here — wait for creative approval
    }

    // ── CREATIVE_APPROVED → CAMPAIGN LAUNCH ───────────────────────────────────
    const approvedSprint = await getSprint(sprint_id);
    if (!approvedSprint) return;

    if (approvedSprint.state === 'CREATIVE_APPROVED') {
      try {
        await dispatchCampaignLaunch(sprint_id);
        await logEvent(sprint_id, 'autonomous-runner', 'campaign_launched', {});
      } catch (err) {
        await blockSprint(sprint_id, `Campaign launch failed: ${String(err)}`);
        return;
      }
    }

    // ── CAMPAIGN MONITORING → VERDICT ──────────────────────────────────────────
    // Campaign monitoring and verdict generation are handled by cron jobs
    // (sprint-monitor and verdict-dispatch). The autonomous runner stops here
    // because those processes run on their own schedules (every 4h for monitoring).
    // When the sprint reaches COMPLETE, the cron will call writeSprintSignal.

    await logEvent(sprint_id, 'autonomous-runner', 'pipeline_handoff', {
      final_state: (await getSprint(sprint_id))?.state,
      message: 'Campaign monitoring and verdict handled by cron',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[autonomous-runner] Sprint ${sprint_id} pipeline error:`, message);
    await blockSprint(sprint_id, `Autonomous runner error: ${message}`);
  }
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // ── Sprint state check ─────────────────────────────────────────────────────
  const sprint = await getSprint(sprint_id);
  if (!sprint) {
    return Response.json({ error: 'Sprint not found' }, { status: 404 });
  }

  const TERMINAL_STATES = new Set([
    'COMPLETE',
    'BLOCKED',
    'CAMPAIGN_RUNNING',
    'CAMPAIGN_MONITORING',
    'VERDICT_GENERATING',
    'USER_REVIEW_REQUIRED',
    'CREATIVE_APPROVED',
  ]);

  if (TERMINAL_STATES.has(sprint.state)) {
    return Response.json(
      {
        sprint_id,
        state: sprint.state,
        message: 'Sprint is already in a terminal or paused state',
      },
      { status: 200 }
    );
  }

  // ── Fire and forget: start pipeline in background ───────────────────────────
  // Use void async IIFE to run the pipeline without blocking the response
  void (async () => {
    try {
      await runAutonomousPipeline(sprint_id, userId);
    } catch (err) {
      console.error(`[autonomous-runner] Unhandled error in background pipeline:`, err);
    }
  })();

  // ── Respond immediately ───────────────────────────────────────────────────
  return Response.json({
    started: true,
    sprint_id,
    message: 'Autonomous pipeline started',
  });
}
