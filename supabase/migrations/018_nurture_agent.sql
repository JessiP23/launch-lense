-- ─────────────────────────────────────────────────────────────────────────────
-- LaunchLense — Nurture Agent Database Migration
--
-- Tables for inbound lead capture, nurture orchestration, touch execution,
-- and retention sequences.
-- ─────────────────────────────────────────────────────────────────────────────

-- nurture_sequences table: reusable nurture sequences (must be created first, referenced by leads)
create table if not exists nurture_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sequence_type text not null, -- 'retention', 'reactivation', 'onboarding'
  touches jsonb not null, -- array of touch objects with delay, channel, template
  default_delay_hours int default 24,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nurture_sequences_type on nurture_sequences(sequence_type);
create index if not exists idx_nurture_sequences_active on nurture_sequences(is_active);

-- nurture_touches table: touch templates for sequences
create table if not exists nurture_touches (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references nurture_sequences(id) on delete cascade,
  touch_order int not null,
  channel text not null, -- 'email', 'linkedin', 'twitter'
  template_id text, -- reference to template in external service
  subject text, -- for email
  body text not null,
  variables jsonb default '{}'::jsonb, -- variables to substitute (e.g., {first_name, company})
  delay_hours int not null default 24,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_nurture_touches_sequence_order on nurture_touches(sequence_id, touch_order);

-- leads table: inbound leads captured from webhooks or manual entry
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  last_name text,
  company text,
  job_title text,
  source text, -- 'webhook', 'manual', 'campaign'
  source_sprint_id uuid references sprints(id) on delete set null,
  source_campaign_id text,
  initial_intent jsonb, -- captured intent/context from source
  status text not null default 'new', -- 'new', 'active', 'paused', 'converted', 'lost'
  assigned_sequence_id uuid references nurture_sequences(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_email on leads(email);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_source_sprint on leads(source_sprint_id);

-- lead_events table: behavioral events for lead scoring and timing
create table if not exists lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  event_type text not null, -- 'page_view', 'email_open', 'email_click', 'form_submit', 'meeting_booked', 'demo_started'
  event_payload jsonb default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_lead_events_lead_id on lead_events(lead_id);
create index if not exists idx_lead_events_type on lead_events(event_type);
create index if not exists idx_lead_events_occurred on lead_events(occurred_at);

-- lead_touch_log table: history of touches sent to leads
create table if not exists lead_touch_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  touch_id uuid references nurture_touches(id) on delete set null,
  channel text not null,
  status text not null, -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'failed'
  external_id text, -- ID from external service (e.g., SendGrid, LinkedIn)
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_touch_log_lead_id on lead_touch_log(lead_id);
create index if not exists idx_lead_touch_log_status on lead_touch_log(status);

-- scheduled_touches table: queue of touches to be sent
create table if not exists scheduled_touches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  touch_id uuid references nurture_touches(id) on delete set null,
  scheduled_for timestamptz not null,
  status text not null default 'pending', -- 'pending', 'processing', 'sent', 'failed'
  attempt_count int default 0,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_scheduled_touches_scheduled_for on scheduled_touches(scheduled_for);
create index if not exists idx_scheduled_touches_status on scheduled_touches(status);

-- Row-Level Security Policies
alter table leads enable row level security;
alter table lead_events enable row level security;
alter table nurture_sequences enable row level security;
alter table nurture_touches enable row level security;
alter table lead_touch_log enable row level security;
alter table scheduled_touches enable row level security;

-- Deny public access
create policy "Deny public access to leads" on leads for all using (false);
create policy "Deny public access to lead_events" on lead_events for all using (false);
create policy "Deny public access to nurture_sequences" on nurture_sequences for all using (false);
create policy "Deny public access to nurture_touches" on nurture_touches for all using (false);
create policy "Deny public access to lead_touch_log" on lead_touch_log for all using (false);
create policy "Deny public access to scheduled_touches" on scheduled_touches for all using (false);
