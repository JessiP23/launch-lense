// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Nurture Agent: Orchestrator
//
// Manages nurture sequence enrollment, touch scheduling, webhook processing,
// and retention sequence orchestration.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';
import { captureInboundLead } from './lead-capture';

// ── Seed default nurture sequences ───────────────────────────────────────────

export async function seedDefaultSequences(): Promise<void> {
  const db = createServiceClient();

  // Check if sequences already exist
  const { data: existing } = await db
    .from('nurture_sequences')
    .select('id')
    .limit(1);
  
  if (existing && existing.length > 0) {
    console.log('[nurture-orchestrator] Default sequences already exist, skipping seed');
    return;
  }

  const sequences = [
    {
      name: 'founder_cold',
      description: 'For new founders with low score',
      sequence_type: 'retention',
      touches: [
        {
          order: 1,
          channel: 'email',
          delay_hours: 0,
          subject: "Your idea could be validated in 48 hours",
          body: "Hi {name}, validating startup ideas used to take months and $50k. LaunchLense does it in 48 hours for $500 — real ads, real people, real verdict. We handle everything: ad accounts, landing pages, budget. You get a PDF you can hand to investors. Have an idea you want to test? Reply with one sentence and I'll show you exactly what we'd do with it.",
        },
        {
          order: 2,
          channel: 'email',
          delay_hours: 48,
          subject: "What a GO verdict looks like",
          body: "Hi {name}, here's what a LaunchLense GO verdict looks like for a real sprint: CTR 2.4% (50% above benchmark), CPA $8.20 (34% below benchmark), 48,200 impressions, $487 spent. The verdict: GO. The founder shipped. {idea_hint ? 'You mentioned: ' + idea_hint + '. Want to test this?' : 'What idea have you been sitting on?'} One prompt is all we need.",
        },
        {
          order: 3,
          channel: 'email',
          delay_hours: 96,
          subject: "The $35,000 mistake we help founders avoid",
          body: "Hi {name}, the average venture studio loses €35,000 building the wrong product. LaunchLense validates in 48 hours for $500. If we're wrong, you pay nothing. If we're right, you just saved months. {idea_hint ? 'We could run ' + idea_hint + ' this week.' : 'What would you test first?'}",
        },
        {
          order: 4,
          channel: 'email',
          delay_hours: 168,
          subject: "Last one from me",
          body: "Hi {name}, I won't keep sending — but if you ever have an idea worth testing before you build it, LaunchLense is at launch-lense.vercel.app. 48 hours. Real verdict. You handle the idea. We handle everything else.",
        },
      ],
    },
    {
      name: 'founder_hot',
      description: 'For founders with score >= 60 who came with an idea',
      sequence_type: 'retention',
      touches: [
        {
          order: 1,
          channel: 'email',
          delay_hours: 0,
          subject: "Your idea is ready to validate",
          body: "Hi {name}, {idea_hint ? 'You mentioned: ' + idea_hint + '. ' : ''}We can have a campaign live within the hour and a verdict in 48 hours. $500, real ads, investor-ready PDF. Want to go? Hit reply or go straight to launch-lense.vercel.app/launch",
        },
        {
          order: 2,
          channel: 'whatsapp',
          delay_hours: 4,
          subject: null,
          body: "Hey {name} 👋 Saw you were checking out LaunchLense. Want to validate {idea_hint || 'your idea'} this week? Takes 5 minutes to set up, 48 hours to get your verdict.",
        },
        {
          order: 3,
          channel: 'email',
          delay_hours: 24,
          subject: "Before you build anything",
          body: "Hi {name}, one question: has anyone actually paid for this yet? If not — that's exactly what a LaunchLense sprint tests. Real people, real ads, real answer. $500. 48 hours. Go?",
        },
      ],
    },
    {
      name: 'vc_warm',
      description: 'For VCs and venture studios',
      sequence_type: 'retention',
      touches: [
        {
          order: 1,
          channel: 'email',
          delay_hours: 0,
          subject: "Validate every portfolio idea before you build",
          body: "Hi {name}, venture studios typically spend 6 months and $140k before learning a product has no market. LaunchLense runs the behavioral test in 48 hours for $500 per idea. We handle the ad accounts, landing pages, and budget. You get a GO/ITERATE/NO-GO verdict and an investor-ready PDF for every idea in your pipeline. Most studios run 4-8 ideas per month. Want to see a sample report?",
        },
        {
          order: 2,
          channel: 'email',
          delay_hours: 72,
          subject: "Sample LaunchLense verdict report",
          body: "Hi {name}, here's what your portfolio companies get from a LaunchLense sprint: [link to sample PDF]. CTR benchmarked against 142 real sprints in the same vertical. GO/NO-GO with a confidence score. ICP discovery from real click data. GTM starter plan. 48 hours. $500. How many ideas is your studio validating this quarter?",
        },
        {
          order: 3,
          channel: 'linkedin',
          delay_hours: 120,
          subject: null,
          body: "Hi {name}, sent you an email about LaunchLense — thought it might be relevant for your portfolio validation process. Happy to share a sample report if useful.",
        },
      ],
    },
    {
      name: 'post_sprint_go',
      description: 'After a GO verdict',
      sequence_type: 'retention',
      touches: [
        {
          order: 1,
          channel: 'email',
          delay_hours: 2,
          subject: "You got a GO — here's what to do next",
          body: "Hi {name}, your sprint came back GO at {confidence_score}% confidence. The data is clear: {best_channel} is your primary channel. Here's what we'd do next: scale the Meta budget to $2,500 and run a conversion campaign. Your next sprint should test {next_headlines[0]}. Want us to run it? Same setup, same 48 hours.",
        },
        {
          order: 2,
          channel: 'email',
          delay_hours: 120,
          subject: "Your GO verdict has a 30-day window",
          body: "Hi {name}, demand signals decay. The market interest you validated 5 days ago is still hot — but competitors are always moving. Run your next sprint while the signal is fresh. 30% off for returning customers this week.",
        },
      ],
    },
    {
      name: 'post_sprint_no_go',
      description: 'After a NO-GO verdict',
      sequence_type: 'retention',
      touches: [
        {
          order: 1,
          channel: 'email',
          delay_hours: 4,
          subject: "Your NO-GO just saved you months",
          body: "Hi {name}, you got a NO-GO. That means you saved yourself 6 months of building and $50k of the wrong product. The data shows: {worst_channel} had the weakest signal. But here's what's interesting: your genome score was {genome_composite}/100, which means the market category has potential — the angle was wrong. Want to run a different angle? We can test it in 48 hours for $250 (returning customer rate).",
        },
      ],
    },
  ];

  for (const seq of sequences) {
    const { data: sequence } = await db
      .from('nurture_sequences')
      .insert({
        name: seq.name,
        description: seq.description,
        sequence_type: seq.sequence_type,
        is_active: true,
      })
      .select('id')
      .single();

    if (!sequence) continue;

    for (const touch of seq.touches) {
      await db.from('nurture_touches').insert({
        sequence_id: sequence.id,
        touch_order: touch.order,
        channel: touch.channel,
        subject: touch.subject,
        body: touch.body,
        variables: {},
        delay_hours: touch.delay_hours,
      });
    }
  }

  console.log('[nurture-orchestrator] Seeded 5 default nurture sequences');
}

// ── Enroll lead in retention sequence ───────────────────────────────────────

export async function enrollInRetentionSequence(leadId: string, sprintId: string): Promise<void> {
  const db = createServiceClient();

  // Find or create retention sequence for this sprint
  let { data: sequence } = await db
    .from('nurture_sequences')
    .select('*')
    .eq('sequence_type', 'retention')
    .eq('name', `sprint_${sprintId}_retention`)
    .maybeSingle();

  if (!sequence) {
    // Create default retention sequence
    const { data: newSequence } = await db
      .from('nurture_sequences')
      .insert({
        name: `sprint_${sprintId}_retention`,
        description: `Retention sequence for sprint ${sprintId}`,
        sequence_type: 'retention',
        touches: [
          {
            order: 1,
            channel: 'email',
            delay_hours: 24,
            template_id: 'retention_welcome',
          },
          {
            order: 2,
            channel: 'email',
            delay_hours: 72,
            template_id: 'retention_followup',
          },
          {
            order: 3,
            channel: 'linkedin',
            delay_hours: 168,
            template_id: 'retention_linkedin',
          },
        ],
        default_delay_hours: 24,
        is_active: true,
      })
      .select('*')
      .single();

    sequence = newSequence;

    // Create touch records
    if (sequence) {
      for (const touch of sequence.touches as any[]) {
        await db.from('nurture_touches').insert({
          sequence_id: sequence.id,
          touch_order: touch.order,
          channel: touch.channel,
          template_id: touch.template_id,
          subject: touch.channel === 'email' ? 'Following up' : null,
          body: `Retention touch ${touch.order} for sprint ${sprintId}`,
          variables: {},
          delay_hours: touch.delay_hours,
        });
      }
    }
  }

  if (!sequence) {
    console.error(`[nurture-orchestrator] Failed to create sequence for sprint ${sprintId}`);
    return;
  }

  // Assign sequence to lead
  await db
    .from('leads')
    .update({
      assigned_sequence_id: sequence.id,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  // Schedule first touch
  await scheduleNextTouch(leadId, sequence.id, 0);

  // Log enrollment event
  await db.from('lead_events').insert({
    lead_id: leadId,
    event_type: 'sequence_enrolled',
    event_payload: { sequence_id: sequence.id, sprint_id: sprintId },
  });

  console.log(`[nurture-orchestrator] Enrolled lead ${leadId} in retention sequence ${sequence.id}`);
}

// ── Schedule next touch in sequence ───────────────────────────────────────────

export async function scheduleNextTouch(leadId: string, sequenceId: string, currentTouchOrder: number): Promise<void> {
  const db = createServiceClient();

  // Get next touch in sequence
  const { data: nextTouch } = await db
    .from('nurture_touches')
    .select('*')
    .eq('sequence_id', sequenceId)
    .eq('touch_order', currentTouchOrder + 1)
    .maybeSingle();

  if (!nextTouch) {
    console.log(`[nurture-orchestrator] No more touches in sequence ${sequenceId} for lead ${leadId}`);
    return;
  }

  // Calculate scheduled time
  const scheduledFor = new Date(Date.now() + nextTouch.delay_hours * 60 * 60 * 1000);

  // Create scheduled touch
  await db.from('scheduled_touches').insert({
    lead_id: leadId,
    touch_id: nextTouch.id,
    scheduled_for: scheduledFor.toISOString(),
    status: 'pending',
  });

  console.log(`[nurture-orchestrator] Scheduled touch ${nextTouch.id} for lead ${leadId} at ${scheduledFor.toISOString()}`);
}

// ── Process scheduled touches (cron job) ───────────────────────────────────────

export async function processScheduledTouches(): Promise<number> {
  const db = createServiceClient();

  // Get pending touches scheduled for now or in the past
  const now = new Date().toISOString();
  const { data: scheduledTouches, error } = await db
    .from('scheduled_touches')
    .select('id, lead_id, touch_id, nurture_touches!inner(*)')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(100);

  if (error) {
    console.error('[nurture-orchestrator] Failed to fetch scheduled touches:', error.message);
    return 0;
  }

  if (!scheduledTouches || scheduledTouches.length === 0) {
    return 0;
  }

  let processed = 0;

  for (const scheduled of scheduledTouches as any[]) {
    try {
      // Mark as processing
      await db
        .from('scheduled_touches')
        .update({ status: 'processing', last_attempt_at: new Date().toISOString(), attempt_count: (scheduled.attempt_count || 0) + 1 })
        .eq('id', scheduled.id);

      // Get lead details
      const { data: lead } = await db
        .from('leads')
        .select('*')
        .eq('id', scheduled.lead_id)
        .single();

      if (!lead) {
        await db.from('scheduled_touches').update({ status: 'failed' }).eq('id', scheduled.id);
        continue;
      }

      // Send touch (this will be implemented with Composio in touch-agent.ts)
      // For now, log the touch as sent
      await db.from('lead_touch_log').insert({
        lead_id: scheduled.lead_id,
        touch_id: scheduled.touch_id,
        channel: scheduled.nurture_touches.channel,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      // Mark scheduled touch as sent
      await db.from('scheduled_touches').update({ status: 'sent' }).eq('id', scheduled.id);

      // Schedule next touch
      const sequenceId = (lead as any).assigned_sequence_id;
      if (sequenceId) {
        await scheduleNextTouch(scheduled.lead_id, sequenceId, scheduled.nurture_touches.touch_order);
      }

      // Log touch event
      await db.from('lead_events').insert({
        lead_id: scheduled.lead_id,
        event_type: 'touch_sent',
        event_payload: { touch_id: scheduled.touch_id, channel: scheduled.nurture_touches.channel },
      });

      processed++;
    } catch (err) {
      console.error(`[nurture-orchestrator] Failed to process scheduled touch ${scheduled.id}:`, err);
      await db.from('scheduled_touches').update({ status: 'failed' }).eq('id', scheduled.id);
    }
  }

  console.log(`[nurture-orchestrator] Processed ${processed} scheduled touches`);
  return processed;
}

// ── Handle behavior webhook ───────────────────────────────────────────────────

export async function handleBehaviorWebhook(event: {
  lead_id?: string;
  email?: string;
  event_type: string;
  event_payload: Record<string, unknown>;
}): Promise<void> {
  const db = createServiceClient();

  let leadId = event.lead_id;

  // If email provided, find lead by email
  if (!leadId && event.email) {
    const { data: lead } = await db
      .from('leads')
      .select('id')
      .eq('email', event.email)
      .maybeSingle();
    leadId = lead?.id;
  }

  if (!leadId) {
    console.warn('[nurture-orchestrator] No lead found for webhook event');
    return;
  }

  // Log lead event
  await db.from('lead_events').insert({
    lead_id: leadId,
    event_type: event.event_type,
    event_payload: event.event_payload,
  });

  // Handle specific event types
  if (event.event_type === 'email_open') {
    await db
      .from('lead_touch_log')
      .update({ opened_at: new Date().toISOString(), status: 'opened' })
      .eq('lead_id', leadId)
      .eq('external_id', event.event_payload.message_id);
  } else if (event.event_type === 'email_click') {
    await db
      .from('lead_touch_log')
      .update({ clicked_at: new Date().toISOString(), status: 'clicked' })
      .eq('lead_id', leadId)
      .eq('external_id', event.event_payload.message_id);
  } else if (event.event_type === 'meeting_booked') {
    // Pause nurture sequence if meeting booked
    await db
      .from('leads')
      .update({ status: 'paused' })
      .eq('id', leadId);
  }

  console.log(`[nurture-orchestrator] Handled webhook event ${event.event_type} for lead ${leadId}`);
}

// ── Auto-enroll leads from sprint with GO verdict ─────────────────────────────

export async function autoEnrollLeadsFromSprint(sprintId: string): Promise<void> {
  const db = createServiceClient();

  // Find leads with source_sprint_id = sprintId
  const { data: leads } = await db
    .from('leads')
    .select('id, status')
    .eq('source_sprint_id', sprintId)
    .eq('status', 'new');

  if (!leads || leads.length === 0) {
    console.log(`[nurture-orchestrator] No new leads to enroll from sprint ${sprintId}`);
    return;
  }

  for (const lead of leads) {
    await enrollInRetentionSequence(lead.id, sprintId);
  }

  console.log(`[nurture-orchestrator] Auto-enrolled ${leads.length} leads from sprint ${sprintId}`);
}
