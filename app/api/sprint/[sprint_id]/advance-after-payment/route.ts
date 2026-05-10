// POST /api/sprint/[sprint_id]/advance-after-payment
//
// Client-side fallback that advances the sprint when the user returns from
// Stripe with ?payment=success, in case the webhook fired before they landed
// or was delayed.
//
// This does NOT bypass Stripe — it queries Stripe directly to confirm the
// session was paid before calling dispatchAngles. Safe to call from the browser.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { isStripePaymentGateEnabled } from '@/lib/payment-gate';
import { dispatchAngles } from '@/lib/sprint-machine';
import { requireStripe } from '@/lib/stripe-server';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> },
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const { data: sprint, error: sprintErr } = await db
    .from('sprints')
    .select('id, state')
    .eq('id', sprint_id)
    .maybeSingle();

  if (sprintErr || !sprint) {
    return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
  }

  // Already advanced — return current state
  if (sprint.state !== 'PAYMENT_PENDING') {
    return NextResponse.json({ state: sprint.state, advanced: false });
  }

  // Payment gate must be enabled for this route to make sense
  if (!isStripePaymentGateEnabled()) {
    return NextResponse.json({ error: 'Payment gate disabled' }, { status: 400 });
  }

  // Verify payment by checking Stripe directly
  let stripe;
  try {
    stripe = requireStripe();
  } catch {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  // Find the most-recent pending session for this sprint
  const { data: payment } = await db
    .from('sprint_payments')
    .select('stripe_session_id, status')
    .eq('sprint_id', sprint_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment?.stripe_session_id) {
    return NextResponse.json({ error: 'No Stripe session found for sprint' }, { status: 404 });
  }

  // If already marked completed in our DB, just dispatch angles
  if (payment.status === 'completed') {
    const updated = await dispatchAngles(sprint_id, { bypassPaymentCheck: true });
    return NextResponse.json({ state: updated.state, advanced: true });
  }

  // Otherwise, ask Stripe whether this session was paid
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
  } catch (e) {
    console.error('[advance-after-payment] Stripe retrieve failed:', String(e));
    return NextResponse.json({ error: 'Could not verify payment with Stripe' }, { status: 502 });
  }

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ state: 'PAYMENT_PENDING', advanced: false, payment_status: session.payment_status });
  }

  // Stripe says it's paid — mark our DB and dispatch
  await db
    .from('sprint_payments')
    .update({ status: 'completed' })
    .eq('stripe_session_id', payment.stripe_session_id);

  const updated = await dispatchAngles(sprint_id, { bypassPaymentCheck: true });
  return NextResponse.json({ state: updated.state, advanced: true });
}
