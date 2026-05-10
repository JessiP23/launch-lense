import { createServiceClient } from '@/lib/supabase';

export async function hasCompletedPayment(sprintId: string): Promise<boolean> {
  const db = createServiceClient();
  const { data } = await db
    .from('sprint_payments')
    .select('id')
    .eq('sprint_id', sprintId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function stripeEventProcessed(eventId: string): Promise<boolean> {
  const db = createServiceClient();
  const { data } = await db.from('stripe_processed_events').select('event_id').eq('event_id', eventId).maybeSingle();
  return Boolean(data);
}

export async function markStripeEventProcessed(eventId: string, eventType: string): Promise<void> {
  const db = createServiceClient();
  await db.from('stripe_processed_events').insert({ event_id: eventId, event_type: eventType });
}
