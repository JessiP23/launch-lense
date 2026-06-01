// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Nurture Agent: Lead Capture
//
// Captures inbound leads from webhooks or manual entry, dedupes by email,
// and assigns to appropriate nurture sequences.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase';

export interface LeadCaptureInput {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  job_title?: string;
  source: 'webhook' | 'manual' | 'campaign';
  source_sprint_id?: string;
  source_campaign_id?: string;
  initial_intent?: Record<string, unknown>;
}

export async function captureInboundLead(input: LeadCaptureInput): Promise<{ lead_id: string; status: string }> {
  const db = createServiceClient();

  // Check if lead already exists by email
  const { data: existingLead } = await db
    .from('leads')
    .select('id, status')
    .eq('email', input.email)
    .maybeSingle();

  if (existingLead) {
    // Update existing lead with new info
    await db
      .from('leads')
      .update({
        first_name: input.first_name || (existingLead as any).first_name,
        last_name: input.last_name || (existingLead as any).last_name,
        company: input.company || (existingLead as any).company,
        job_title: input.job_title || (existingLead as any).job_title,
        metadata: {
          ...(existingLead as any).metadata,
          last_captured_at: new Date().toISOString(),
          capture_source: input.source,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingLead.id);

    // Log lead event for new capture
    await db.from('lead_events').insert({
      lead_id: existingLead.id,
      event_type: 'lead_recaptured',
      event_payload: {
        source: input.source,
        source_sprint_id: input.source_sprint_id,
        initial_intent: input.initial_intent,
      },
    });

    return { lead_id: existingLead.id, status: existingLead.status };
  }

  // Create new lead
  const { data: newLead, error } = await db
    .from('leads')
    .insert({
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      company: input.company,
      job_title: input.job_title,
      source: input.source,
      source_sprint_id: input.source_sprint_id,
      source_campaign_id: input.source_campaign_id,
      initial_intent: input.initial_intent,
      status: 'new',
      metadata: {
        captured_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (error) {
    console.error('[lead-capture] Failed to create lead:', error.message);
    throw new Error(`Failed to create lead: ${error.message}`);
  }

  // Log lead creation event
  await db.from('lead_events').insert({
    lead_id: newLead.id,
    event_type: 'lead_created',
    event_payload: {
      source: input.source,
      source_sprint_id: input.source_sprint_id,
      initial_intent: input.initial_intent,
    },
  });

  return { lead_id: newLead.id, status: 'new' };
}
