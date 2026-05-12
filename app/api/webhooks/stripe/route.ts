// POST /api/webhooks/stripe — verifies signature; fulfillment only on checkout.session.completed
// CRITICAL: raw body must be read with req.text() — Next.js must NOT parse it as JSON.
// next.config must have `bodyParser: false` for this route OR use the runtime below.

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { dispatchAngles } from '@/lib/sprint-machine';
import { stripeEventProcessed, markStripeEventProcessed } from '@/lib/payments/db';
import { emitSprintEvent, SprintEventName } from '@/lib/analytics/events';
import { requireStripe } from '@/lib/stripe-server';
import { isStripePaymentGateEnabled } from '@/lib/payment-gate';
import type { Platform } from '@/lib/agents/types';
import type Stripe from 'stripe';

export async function POST(req: NextRequest) {
  if (!isStripePaymentGateEnabled()) {
    return NextResponse.json({ error: 'Payment gate disabled' }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET missing');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  let stripe;
  try {
    stripe = requireStripe();
  } catch {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  // Raw body is required for Stripe signature verification
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.warn('[stripe webhook] signature failed:', String(err));
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotency: skip if we already processed this event
  if (await stripeEventProcessed(event.id)) {
    console.log(`[stripe webhook] already processed ${event.id}`);
    return NextResponse.json({ received: true });
  }

  // Only handle checkout.session.completed — ack all others immediately
  if (event.type !== 'checkout.session.completed') {
    await markStripeEventProcessed(event.id, event.type);
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sprintId = session.metadata?.sprint_id;

  if (!sprintId) {
    console.error('[stripe webhook] missing sprint_id in session metadata', session.id);
    // Mark processed so Stripe stops retrying this unfulfillable event
    await markStripeEventProcessed(event.id, event.type);
    return NextResponse.json({ error: 'No sprint_id' }, { status: 400 });
  }

  console.log(`[stripe webhook] fulfilling sprint ${sprintId} — session ${session.id}`);

  const db = createServiceClient();

  // ── 1. Update sprint_payments — mark payment completed ───────────────────
  const paymentIntent =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

  const { error: payErr } = await db
    .from('sprint_payments')
    .update({ status: 'completed', stripe_payment_intent: paymentIntent })
    .eq('stripe_session_id', session.id);

  if (payErr) {
    // sprint_payments row may not exist if the checkout was created outside our app.
    // Upsert so downstream payment check always finds it.
    console.warn('[stripe webhook] sprint_payments update failed, upserting:', payErr.message);
    await db.from('sprint_payments').upsert({
      sprint_id: sprintId,
      stripe_session_id: session.id,
      stripe_payment_intent: paymentIntent,
      status: 'completed',
      total_amount_cents: session.amount_total ?? 0,
      channel_allocation: {},
    });
  }

  // ── 2. Optionally update sprint budget / active_channels from metadata ────
  const adSpendCents = parseInt(session.metadata?.ad_spend_cents ?? '0', 10) || 0;
  let channels: Platform[] | undefined;
  try {
    if (session.metadata?.channels) {
      channels = JSON.parse(session.metadata.channels) as Platform[];
    }
  } catch {
    channels = undefined;
  }

  const sprintPatch: Record<string, unknown> = {};
  if (adSpendCents > 0) sprintPatch.budget_cents = adSpendCents;
  if (channels?.length) sprintPatch.active_channels = channels;
  if (Object.keys(sprintPatch).length) {
    await db.from('sprints').update(sprintPatch).eq('id', sprintId);
  }

  // ── 3. Advance sprint machine — BYPASSING payment re-check ───────────────
  // We already verified payment via Stripe signature + sprint_payments upsert above.
  // bypassPaymentCheck avoids a race condition where the DB update hasn't
  // propagated before hasCompletedPayment() runs.
  let finalState = 'PAYMENT_PENDING';
  try {
    const updated = await dispatchAngles(sprintId, { bypassPaymentCheck: true });
    finalState = updated.state;
    console.log(`[stripe webhook] sprint ${sprintId} → ${finalState}`);
  } catch (e) {
    console.error('[stripe webhook] dispatchAngles error:', String(e));
    // Return 500 so Stripe retries, UNLESS we know it's a permanent failure
    const msg = String(e);
    const permanent =
      msg.includes('not found') ||
      msg.includes('ANGLES_RUNNING') ||
      msg.includes('ANGLES_DONE');
    if (!permanent) {
      // Transient error — let Stripe retry (don't mark processed yet)
      return NextResponse.json({ error: 'fulfillment_failed' }, { status: 500 });
    }
    // Permanent / already done — fall through and mark processed
  }

  // ── 4. Fire-and-forget audit log (non-blocking) ───────────────────────────
  db.from('sprint_events')
    .insert({
      sprint_id: sprintId,
      agent: 'orchestrator',
      event_type: 'payment_completed',
      payload: {
        session_id: session.id,
        amount_total: session.amount_total,
        state: finalState,
      },
    })
    .then(({ error }) => {
      if (error) console.warn('[stripe webhook] sprint_events insert:', error.message);
    });

  // ── 5. PostHog analytics ─────────────────────────────────────────────────
  const amountTotal = session.amount_total ?? 0;
  const adSpendFee = adSpendCents;
  const platformFee = amountTotal - adSpendFee;
  emitSprintEvent(sprintId, SprintEventName.PaymentCompleted, {
    stripe_session_id: session.id,
    total_amount_cents: amountTotal,
    ad_spend_cents: adSpendFee,
    platform_fee_cents: platformFee,
  }).catch((e) => console.warn('[stripe webhook] posthog:', String(e)));

  // ── 6. Mark event processed so retries are de-duped ──────────────────────
  await markStripeEventProcessed(event.id, event.type);

  return NextResponse.json({ received: true });
}
