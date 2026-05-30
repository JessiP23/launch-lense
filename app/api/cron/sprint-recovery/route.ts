// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cron/sprint-recovery
//
// Cron-based sprint health monitor. Queries for sprints stuck in non-terminal
// states for > 4 hours and performs recovery actions.
//
// Recovery logic:
// - Sprints stuck in running states (GENOME_RUNNING, HEALTHGATE_RUNNING, etc.) for > 4h → BLOCKED
// - Sprints stuck in intermediate states (GENOME_DONE, HEALTHGATE_DONE, etc.) → attempt to advance
// - Logs recovery events to sprint events table
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { transitionState, blockSprint, getSprint } from '@/lib/sprint-machine';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';

// Non-terminal states that should not persist for > 4 hours
const RUNNING_STATES = [
  'GENOME_RUNNING',
  'HEALTHGATE_RUNNING',
  'ANGLES_RUNNING',
  'LANDING_RUNNING',
  'CAMPAIGN_CREATING',
  'CAMPAIGN_MONITORING',
  'VERDICT_GENERATING',
] as const;

// Intermediate states that may need advancement
const INTERMEDIATE_STATES = [
  'GENOME_DONE',
  'HEALTHGATE_DONE',
  'ANGLES_DONE',
  'LANDING_DONE',
] as const;

// Terminal states (no recovery needed)
const TERMINAL_STATES = [
  'IDLE',
  'COMPLETE',
  'BLOCKED',
  'PAYMENT_PENDING',
  'USER_REVIEW_REQUIRED',
  'CREATIVE_APPROVED',
] as const;

const STUCK_THRESHOLD_HOURS = 4;

export async function POST(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();
  const now = new Date();
  const stuckThreshold = new Date(now.getTime() - STUCK_THRESHOLD_HOURS * 60 * 60 * 1000);

  try {
    // Query for sprints stuck in running states
    const { data: stuckRunning, error: runningError } = await db
      .from('sprints')
      .select('id, state, updated_at')
      .in('state', RUNNING_STATES)
      .lt('updated_at', stuckThreshold.toISOString());

    if (runningError) {
      console.error('[SprintRecovery] Failed to query stuck running sprints:', runningError);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    // Query for sprints stuck in intermediate states
    const { data: stuckIntermediate, error: intermediateError } = await db
      .from('sprints')
      .select('id, state, updated_at')
      .in('state', INTERMEDIATE_STATES)
      .lt('updated_at', stuckThreshold.toISOString());

    if (intermediateError) {
      console.error('[SprintRecovery] Failed to query stuck intermediate sprints:', intermediateError);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    const recovered: Array<{ id: string; action: string; previousState: string }> = [];

    // Recover stuck running sprints → BLOCKED
    for (const sprint of stuckRunning ?? []) {
      try {
        const hoursStuck = Math.floor((now.getTime() - new Date(sprint.updated_at).getTime()) / (60 * 60 * 1000));
        const reason = `Sprint stuck in ${sprint.state} for ${hoursStuck}h (threshold: ${STUCK_THRESHOLD_HOURS}h). Auto-recovery: marked as BLOCKED.`;

        await blockSprint(sprint.id, reason);
        await emitSprintEvent(sprint.id, SprintEventName.SprintRecovered, {
          previous_state: sprint.state,
          action: 'BLOCKED',
          reason,
        });

        recovered.push({ id: sprint.id, action: 'BLOCKED', previousState: sprint.state });
        console.log(`[SprintRecovery] Blocked stuck sprint ${sprint.id} (${sprint.state} for ${hoursStuck}h)`);
      } catch (err) {
        console.error(`[SprintRecovery] Failed to block sprint ${sprint.id}:`, err);
      }
    }

    // Attempt to advance stuck intermediate sprints
    for (const sprint of stuckIntermediate ?? []) {
      try {
        const hoursStuck = Math.floor((now.getTime() - new Date(sprint.updated_at).getTime()) / (60 * 60 * 1000));
        const sprintRecord = await getSprint(sprint.id);

        if (!sprintRecord) {
          console.error(`[SprintRecovery] Sprint ${sprint.id} not found`);
          continue;
        }

        // Simple advancement logic based on current state
        let nextState: string | null = null;
        switch (sprint.state) {
          case 'GENOME_DONE':
            nextState = 'HEALTHGATE_RUNNING';
            break;
          case 'HEALTHGATE_DONE':
            nextState = 'ANGLES_RUNNING';
            break;
          case 'ANGLES_DONE':
            nextState = 'USER_REVIEW_REQUIRED';
            break;
          case 'LANDING_DONE':
            nextState = 'CAMPAIGN_CREATING';
            break;
        }

        if (nextState) {
          await transitionState(sprint.id, nextState as any);
          await emitSprintEvent(sprint.id, SprintEventName.SprintRecovered, {
            previous_state: sprint.state,
            action: 'ADVANCED',
            next_state: nextState,
          });

          recovered.push({ id: sprint.id, action: 'ADVANCED', previousState: sprint.state });
          console.log(`[SprintRecovery] Advanced sprint ${sprint.id} from ${sprint.state} to ${nextState}`);
        }
      } catch (err) {
        console.error(`[SprintRecovery] Failed to advance sprint ${sprint.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      recovered: recovered.length,
      details: recovered,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error('[SprintRecovery] Unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
