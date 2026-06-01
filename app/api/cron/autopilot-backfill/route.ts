import { createServiceClient } from '@/lib/supabase';

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = request.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();

  // Query autopilot_decisions where outcome_after_1h IS NULL AND created_at < now() - interval '1 hour'
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: decisions, error } = await db
    .from('autopilot_decisions')
    .select('*')
    .is('outcome_after_1h', null)
    .lt('created_at', oneHourAgo);

  if (error) {
    console.error('[autopilot-backfill] Failed to fetch decisions:', error.message);
    return Response.json({ error: 'Failed to fetch decisions' }, { status: 500 });
  }

  if (!decisions || decisions.length === 0) {
    return Response.json({ ok: true, processed: 0 });
  }

  let processed = 0;

  for (const decision of decisions) {
    try {
      // Read sprint.campaign to extract current metrics for the decision's channel
      const { data: sprint } = await db
        .from('sprints')
        .select('campaign')
        .eq('id', decision.sprint_id)
        .single();

      if (!sprint?.campaign) continue;

      const channelData = (sprint.campaign as Record<string, any>)[decision.channel];
      if (!channelData) continue;

      const ctr = channelData.angle_metrics?.[0]?.ctr || 0;
      const cpc = channelData.angle_metrics?.[0]?.cpc_cents || 0;
      const cpa = channelData.angle_metrics?.[0]?.spend_cents 
        ? channelData.angle_metrics[0].spend_cents / (channelData.angle_metrics[0].clicks || 1)
        : null;

      // Update autopilot_decisions with outcome_after_1h
      await db
        .from('autopilot_decisions')
        .update({
          outcome_after_1h: { ctr, cpa, cpc, timestamp: new Date().toISOString() },
        })
        .eq('id', decision.id);

      // If decision_type was 'pause' and current metrics show improvement: write sprint_events
      if (decision.decision_type === 'pause' && ctr > 0.01) {
        await db.from('sprint_events').insert({
          sprint_id: decision.sprint_id,
          agent: 'autopilot',
          event_type: 'autopilot_learning_signal',
          payload: { decision_id: decision.id, improvement: true },
        });
      }

      processed++;
    } catch (err) {
      console.error(`[autopilot-backfill] Failed to backfill decision ${decision.id}:`, err);
    }
  }

  return Response.json({ ok: true, processed, fired_at: new Date().toISOString() });
}
