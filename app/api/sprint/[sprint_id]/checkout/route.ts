// POST /api/sprint/[sprint_id]/checkout — Stripe Checkout for platform fee + ad spend

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requestAppOrigin } from '@/lib/google/public-url';
import { isStripePaymentGateEnabled } from '@/lib/payment-gate';
import { PLATFORM_FEE_CENTS, validateChannelBudgets, type ChannelBudgetUsd } from '@/lib/budget';
import { requireStripe } from '@/lib/stripe-server';
import { captureServerEvent } from '@/lib/analytics/server-posthog';
import type { Platform } from '@/lib/agents/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> },
) {
  if (!isStripePaymentGateEnabled()) {
    return Response.json({ error: 'Stripe payment gate is disabled' }, { status: 400 });
  }

  const { sprint_id } = await params;
  const db = createServiceClient();

  const { data: sprint, error: sprintErr } = await db.from('sprints').select('*').eq('id', sprint_id).single();
  if (sprintErr || !sprint) return Response.json({ error: 'Sprint not found' }, { status: 404 });
  if (sprint.state !== 'HEALTHGATE_DONE') {
    return Response.json(
      { error: `Budget checkout is only available after Healthgate (${sprint.state})` },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({})) as { budgets?: ChannelBudgetUsd };
  const active = (sprint.active_channels ?? []) as Platform[];
  if (!active.length) return Response.json({ error: 'No active channels on sprint' }, { status: 400 });

  const { allocationCents, adSpendCents, error: vErr } = validateChannelBudgets(active, body.budgets ?? {});
  if (vErr) return Response.json({ error: vErr }, { status: 400 });

  const paidChannels = Object.keys(allocationCents) as Platform[];
  const origin = requestAppOrigin(req);

  let stripe;
  try {
    stripe = requireStripe();
  } catch {
    return Response.json({ error: 'Stripe is not configured' }, { status: 503 });
  }

  const lineItems = [
    {
      price_data: {
        currency: 'usd' as const,
        product_data: { name: 'LaunchLense sprint platform fee' },
        unit_amount: PLATFORM_FEE_CENTS,
      },
      quantity: 1,
    },
    ...paidChannels.map((ch) => ({
      price_data: {
        currency: 'usd' as const,
        product_data: {
          name: `${ch} ad spend`,
          description: 'Validation sprint ad spend allocation',
        },
        unit_amount: allocationCents[ch],
      },
      quantity: 1,
    })),
  ];

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/canvas/${encodeURIComponent(sprint_id)}?payment=success`,
      cancel_url: `${origin}/canvas/${encodeURIComponent(sprint_id)}?payment=cancelled`,
      metadata: {
        sprint_id,
        ad_spend_cents: String(adSpendCents),
        platform_fee_cents: String(PLATFORM_FEE_CENTS),
        channels: JSON.stringify(paidChannels),
        allocation: JSON.stringify(allocationCents),
      },
    },
    { idempotencyKey: `checkout_${sprint_id}_${randomUUID()}` },
  );

  if (!session.url) {
    return Response.json({ error: 'Stripe did not return a checkout URL' }, { status: 500 });
  }

  const totalAmountCents = PLATFORM_FEE_CENTS + adSpendCents;

  await db.from('sprint_payments').insert({
    sprint_id,
    stripe_session_id: session.id,
    status: 'pending',
    total_amount_cents: totalAmountCents,
    platform_fee_cents: PLATFORM_FEE_CENTS,
    ad_spend_cents: adSpendCents,
    channel_allocation: allocationCents,
  });

  await db
    .from('sprints')
    .update({ state: 'PAYMENT_PENDING', budget_cents: adSpendCents, updated_at: new Date().toISOString() })
    .eq('id', sprint_id);

  await captureServerEvent(sprint_id, 'payment_initiated', {
    sprint_id,
    stripe_session_id: session.id,
    channels: paidChannels,
    total_budget_usd: adSpendCents / 100,
    platform_fee_usd: PLATFORM_FEE_CENTS / 100,
  });

  return Response.json({ checkout_url: session.url, session_id: session.id });
}
