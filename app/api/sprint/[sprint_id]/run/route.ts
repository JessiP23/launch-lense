// POST /api/sprint/[sprint_id]/run
//
// Runs exactly ONE pipeline stage per call and returns the result.
// The canvas auto-calls this again when it observes a state transition
// via Supabase Realtime — so the full pipeline is driven without any
// single function call exceeding the Vercel Hobby 10s limit.
//
// Stage routing:
//   IDLE             → runs GenomeAgent      (~4–8s)
//   GENOME_DONE      → runs HealthgateAgent  (<1s)
//   HEALTHGATE_DONE  → runs AngleAgent       (~4–7s)
//   anything else    → no-op, returns current state
//
// Stops at: BLOCKED, PAYMENT_PENDING, ANGLES_DONE, or already-terminal states.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSprint } from '@/lib/sprint-machine';
import { runNextStage } from '@/lib/orchestrator';
import { parseBody, SprintRunSchema } from '@/lib/schemas';
import type { Platform } from '@/lib/agents/types';

const TERMINAL_STATES = new Set([
  'COMPLETE',
  'BLOCKED',
  'CAMPAIGN_RUNNING',
  'CAMPAIGN_MONITORING',
  'VERDICT_GENERATING',
  'ANGLES_DONE',
  'LANDING_RUNNING',
  'LANDING_DONE',
]);

const RUNNING_STATES = new Set([
  'GENOME_RUNNING',
  'HEALTHGATE_RUNNING',
  'ANGLES_RUNNING',
]);

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

  // ── Body (optional channel data for Healthgate) ───────────────────────────
  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { rawBody = {}; }
  const { data: body, error: parseError } = parseBody(SprintRunSchema, rawBody);
  if (parseError) return parseError;

  // ── Sprint state check ────────────────────────────────────────────────────
  const sprint = await getSprint(sprint_id);
  if (!sprint) return Response.json({ error: 'Sprint not found' }, { status: 404 });

  if (TERMINAL_STATES.has(sprint.state)) {
    return Response.json({ sprint_id, state: sprint.state, message: 'No action needed' }, { status: 200 });
  }

  if (RUNNING_STATES.has(sprint.state)) {
    return Response.json({ sprint_id, state: sprint.state, message: 'Stage already running' }, { status: 200 });
  }

  if (sprint.state === 'PAYMENT_PENDING') {
    return Response.json({ sprint_id, state: sprint.state, message: 'Payment required' }, { status: 402 });
  }

  // ── Run exactly one stage synchronously ──────────────────────────────────
  const channelData = (body.channel_data ?? {}) as Partial<Record<Platform, Record<string, unknown>>>;

  const result = await runNextStage(sprint_id, sprint.state, {
    channelData,
    userId,
    bypassPaymentCheck: false,
  });

  // Payment gate — Healthgate ran, angles need payment first
  if (result.final_state === 'PAYMENT_PENDING') {
    return Response.json({
      sprint_id,
      state: result.final_state,
      message: 'Payment required to continue',
    }, { status: 402 });
  }

  return Response.json({
    sprint_id,
    state: result.final_state,
    stage_run: result.stages_run[0] ?? null,
    blocked_reason: result.blocked_reason,
    error: result.error,
  });
}
