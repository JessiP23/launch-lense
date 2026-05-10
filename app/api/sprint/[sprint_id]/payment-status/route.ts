// GET /api/sprint/[sprint_id]/payment-status — Stripe gate + latest payment row

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { isStripePaymentGateEnabled } from '@/lib/payment-gate';
import { hasCompletedPayment } from '@/lib/payments/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sprint_id: string }> },
) {
  const { sprint_id } = await params;
  const db = createServiceClient();

  const { data: sprint } = await db.from('sprints').select('id, state').eq('id', sprint_id).maybeSingle();
  if (!sprint) return Response.json({ error: 'Sprint not found' }, { status: 404 });

  const gate = isStripePaymentGateEnabled();
  if (!gate) {
    return Response.json({
      gate_enabled: false,
      completed: true,
      state: sprint.state,
    });
  }

  const completed = await hasCompletedPayment(sprint_id);
  const { data: latest } = await db
    .from('sprint_payments')
    .select('status, stripe_session_id, created_at')
    .eq('sprint_id', sprint_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json({
    gate_enabled: true,
    completed,
    state: sprint.state,
    latest_payment: latest ?? null,
  });
}
