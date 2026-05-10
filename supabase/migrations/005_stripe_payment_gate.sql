-- Sprint payment gate (Stripe Checkout) + processed webhook idempotency

alter table sprints drop constraint if exists sprints_state_check;

alter table sprints add constraint sprints_state_check check (state in (
  'IDLE','GENOME_RUNNING','GENOME_DONE',
  'HEALTHGATE_RUNNING','HEALTHGATE_DONE',
  'PAYMENT_PENDING',
  'ANGLES_RUNNING','ANGLES_DONE',
  'LANDING_RUNNING','LANDING_DONE',
  'CAMPAIGN_RUNNING','CAMPAIGN_MONITORING',
  'VERDICT_GENERATING','COMPLETE','BLOCKED'
));

create table if not exists sprint_payments (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,
  stripe_session_id text unique,
  stripe_payment_intent text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'cancelled')),
  total_amount_cents int not null default 0,
  platform_fee_cents int not null default 4900,
  ad_spend_cents int not null default 0,
  channel_allocation jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_sprint_payments_sprint on sprint_payments(sprint_id, created_at desc);

create table if not exists stripe_processed_events (
  event_id text primary key,
  event_type text,
  processed_at timestamptz default now()
);

alter table sprint_payments enable row level security;
alter table stripe_processed_events enable row level security;

create policy "sprint_payments_select" on sprint_payments
  for select using (
    sprint_id in (
      select id from sprints where
        org_id in (select org_id from org_members where user_id = (auth.jwt()->>'sub'))
        or org_id is null
    )
  );

create policy "sprint_payments_insert" on sprint_payments for insert with check (true);
create policy "sprint_payments_update" on sprint_payments for update using (true);

create policy "stripe_events_select" on stripe_processed_events for select using (false);
create policy "stripe_events_insert" on stripe_processed_events for insert with check (true);
