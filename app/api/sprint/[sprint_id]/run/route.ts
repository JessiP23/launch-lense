// POST /api/sprint/[sprint_id]/run
//
// Master server-side orchestration endpoint.
//
// The canvas calls this ONCE instead of driving sequential agent calls.
// The route:
//   1. Validates auth + input
//   2. Returns 202 immediately (sprint is accepted for processing)
//   3. Runs the full pipeline in after() — no browser dependency
//   4. Each stage writes to Supabase; canvas observes via Realtime
//
// The pipeline stops at BLOCKED, PAYMENT_PENDING, or ANGLES_DONE.
// Campaign launch and monitoring are separate (user action + cron).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro — allows full Genome + Healthgate + Angles in one invocation

import { NextRequest } from 'next/server';
import { after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSprint } from '@/lib/sprint-machine';
import { runSprintPipeline } from '@/lib/orchestrator';
import { parseBody, SprintRunSchema } from '@/lib/schemas';

const TERMINAL_STATES = new Set([
  'COMPLETE',
  'BLOCKED',
  'CAMPAIGN_RUNNING',
  'CAMPAIGN_MONITORING',
  'VERDICT_GENERATING',
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

  // ── Auth ────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // ── Body validation ──────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    rawBody = {};
  }

  const { data: body, error: parseError } = parseBody(SprintRunSchema, rawBody);
  if (parseError) return parseError;

  // ── Sprint state check ───────────────────────────────────────────────────
  const sprint = await getSprint(sprint_id);
  if (!sprint) {
    return Response.json({ error: 'Sprint not found' }, { status: 404 });
  }

  // Guard: already at a terminal state
  if (TERMINAL_STATES.has(sprint.state)) {
    return Response.json(
      { sprint_id, state: sprint.state, message: `Sprint is already in terminal state: ${sprint.state}` },
      { status: 409 }
    );
  }

  // Guard: already running — return current state and let Realtime drive the UI
  if (RUNNING_STATES.has(sprint.state)) {
    return Response.json(
      { sprint_id, state: sprint.state, message: 'Pipeline is already running' },
      { status: 200 }
    );
  }

  // Guard: payment pending — cannot auto-advance
  if (sprint.state === 'PAYMENT_PENDING') {
    return Response.json(
      { sprint_id, state: sprint.state, message: 'Payment required to continue' },
      { status: 402 }
    );
  }

  // ── Respond immediately — pipeline runs in after() ──────────────────────
  const channelData = body.channel_data ?? {};

  after(async () => {
    try {
      await runSprintPipeline(sprint_id, {
        channelData,
        userId,
        bypassPaymentCheck: false,
      });
    } catch (err) {
      console.error(`[run] after() pipeline error for sprint ${sprint_id}:`, err);
    }
  });

  return Response.json(
    {
      sprint_id,
      state: sprint.state,
      message: 'Pipeline started — observe state via Supabase Realtime',
    },
    { status: 202 }
  );
}
