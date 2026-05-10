// POST /api/sprint/[sprint_id]/angles
// Dispatches AngleAgent using Genome output.
// Requires HEALTHGATE_DONE state.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { dispatchAngles } from '@/lib/sprint-machine';
import { isStripePaymentGateEnabled } from '@/lib/payment-gate';
import { hasCompletedPayment } from '@/lib/payments/db';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> }
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const { data: sprint } = await db.from('sprints').select('*').eq('id', sprint_id).single();
  if (!sprint) return Response.json({ error: 'Sprint not found' }, { status: 404 });
  if (!['HEALTHGATE_DONE', 'PAYMENT_PENDING'].includes(sprint.state)) {
    return Response.json(
      { error: `Sprint is in ${sprint.state} — Healthgate (or payment) must complete first` },
      { status: 409 },
    );
  }

  if (isStripePaymentGateEnabled()) {
    const paid = await hasCompletedPayment(sprint_id);
    if (!paid) {
      return Response.json({ error: 'Payment required', code: 'payment_required' }, { status: 402 });
    }
  }

  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'angle',
    event_type: 'started',
    payload: { channels: sprint.active_channels },
  });

  const updated = await dispatchAngles(sprint_id);

  await db.from('sprint_events').insert({
    sprint_id,
    agent: 'angle',
    event_type: updated.state === 'BLOCKED' ? 'blocked' : 'completed',
    payload: {
      angle_count: updated.angles?.angles?.length ?? 0,
      archetypes: updated.angles?.angles?.map((a) => a.archetype) ?? [],
    },
  });

  return Response.json({
    sprint_id,
    state: updated.state,
    angles: updated.angles,
    blocked_reason: updated.blocked_reason,
  });
}
