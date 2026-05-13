-- LaunchLense v8 — Managed-account campaign normalization
-- Adds normalized tables for campaigns, ads, metrics, LP events, and angle
-- results so we stop bloating the sprints.campaign JSONB blob. JSONB columns
-- remain as a cache for fast canvas reads; these tables are the source of truth.

-- ── 1. Expand sprint state machine ────────────────────────────────────────
-- Adds the explicit states the orchestration brief calls for so existing
-- consumers keep working but new code paths can use clearer names.

alter table sprints drop constraint if exists sprints_state_check;

alter table sprints add constraint sprints_state_check check (state in (
  'IDLE','GENOME_RUNNING','GENOME_DONE',
  'HEALTHGATE_RUNNING','HEALTHGATE_DONE',
  'PAYMENT_PENDING','PAYMENT_CONFIRMED',
  'ANGLES_RUNNING','ANGLES_DONE',
  'LANDING_RUNNING','LANDING_DONE',
  'CAMPAIGN_CREATING','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','MONITORING',
  'VERDICT_GENERATING','VERDICT_RUNNING','COMPLETE','BLOCKED'
));

-- ── 2. sprint_campaigns ───────────────────────────────────────────────────

create table if not exists sprint_campaigns (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,
  channel text not null check (channel in ('meta','google','linkedin','tiktok')),
  campaign_id text,
  adset_map jsonb not null default '{}'::jsonb,  -- { angle_id → adset_id }
  ad_map jsonb not null default '{}'::jsonb,     -- { angle_id → ad_id }
  daily_budget_cents int not null default 0,
  total_budget_cents int not null default 0,
  status text not null default 'PENDING' check (status in (
    'PENDING','CREATING','ACTIVE','PAUSED','POLICY_BLOCKED','COMPLETE','FAILED'
  )),
  last_polled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (sprint_id, channel)
);

create index if not exists idx_sprint_campaigns_sprint on sprint_campaigns(sprint_id);
create index if not exists idx_sprint_campaigns_status on sprint_campaigns(status);

-- ── 3. sprint_ads ─────────────────────────────────────────────────────────

create table if not exists sprint_ads (
  id uuid primary key default gen_random_uuid(),
  sprint_campaign_id uuid not null references sprint_campaigns(id) on delete cascade,
  angle_id text not null,
  adset_id text,
  ad_id text,
  creative_id text,
  lp_url text,
  status text not null default 'PAUSED',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (sprint_campaign_id, angle_id)
);

create index if not exists idx_sprint_ads_campaign on sprint_ads(sprint_campaign_id);

-- ── 4. sprint_metrics (poll snapshots, append-only) ───────────────────────

create table if not exists sprint_metrics (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,
  sprint_campaign_id uuid references sprint_campaigns(id) on delete cascade,
  angle_id text,
  channel text not null,
  impressions int not null default 0,
  clicks int not null default 0,
  ctr numeric(8,5) not null default 0,
  cpc_cents int not null default 0,
  cpm_cents int not null default 0,
  spend_cents int not null default 0,
  frequency numeric(8,4) not null default 0,
  outbound_clicks int not null default 0,
  leads int not null default 0,
  raw jsonb not null default '{}'::jsonb,
  polled_at timestamptz default now()
);

create index if not exists idx_sprint_metrics_sprint on sprint_metrics(sprint_id, polled_at desc);
create index if not exists idx_sprint_metrics_angle on sprint_metrics(sprint_id, angle_id, polled_at desc);

-- ── 5. sprint_lp_events (normalized landing-page events) ──────────────────

create table if not exists sprint_lp_events (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid references sprints(id) on delete cascade,
  test_id uuid references tests(id) on delete cascade,
  angle_id text,
  channel text,
  event_name text not null,
  event_id text,                       -- dedupes with browser pixel
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  fbclid text,
  fbc text,
  fbp text,
  ip text,
  user_agent text,
  email_hash text,                     -- SHA256 for downstream CAPI replays
  page_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_sprint_lp_events_sprint on sprint_lp_events(sprint_id, created_at desc);
create index if not exists idx_sprint_lp_events_test on sprint_lp_events(test_id, created_at desc);
create index if not exists idx_sprint_lp_events_event_id on sprint_lp_events(event_id);
create index if not exists idx_sprint_lp_events_angle on sprint_lp_events(sprint_id, angle_id);

-- ── 6. sprint_angle_results (denormalized rollup for VerdictAgent) ────────

create table if not exists sprint_angle_results (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,
  angle_id text not null,
  channel text not null,
  impressions int not null default 0,
  clicks int not null default 0,
  ctr numeric(8,5) not null default 0,
  cpc_cents int not null default 0,
  spend_cents int not null default 0,
  lp_views int not null default 0,
  lp_cta_clicks int not null default 0,
  lp_form_submits int not null default 0,
  lp_email_captures int not null default 0,
  scroll_50_pct int not null default 0,
  scroll_75_pct int not null default 0,
  scroll_100_pct int not null default 0,
  meta_leads int not null default 0,
  computed_at timestamptz default now(),
  unique (sprint_id, angle_id, channel)
);

create index if not exists idx_sprint_angle_results_sprint on sprint_angle_results(sprint_id);

-- ── 7. capi_processed_events (idempotency for CAPI sends) ─────────────────
-- Lets us safely retry CAPI emission on cron resumes without double-counting.

create table if not exists capi_processed_events (
  event_id text primary key,
  sprint_id uuid,
  event_name text not null,
  sent_at timestamptz default now()
);

create index if not exists idx_capi_processed_sprint on capi_processed_events(sprint_id, sent_at desc);

-- ── 8. RLS ────────────────────────────────────────────────────────────────

alter table sprint_campaigns enable row level security;
alter table sprint_ads enable row level security;
alter table sprint_metrics enable row level security;
alter table sprint_lp_events enable row level security;
alter table sprint_angle_results enable row level security;
alter table capi_processed_events enable row level security;

-- Inherit sprint visibility for all sprint-scoped tables.
create policy "sprint_campaigns_select" on sprint_campaigns
  for select using (
    sprint_id in (
      select id from sprints where
        org_id is null or org_id in (select org_id from org_members where user_id = (auth.jwt() ->> 'sub'))
    )
  );

create policy "sprint_ads_select" on sprint_ads
  for select using (
    sprint_campaign_id in (
      select id from sprint_campaigns where sprint_id in (
        select id from sprints where
          org_id is null or org_id in (select org_id from org_members where user_id = (auth.jwt() ->> 'sub'))
      )
    )
  );

create policy "sprint_metrics_select" on sprint_metrics
  for select using (
    sprint_id in (
      select id from sprints where
        org_id is null or org_id in (select org_id from org_members where user_id = (auth.jwt() ->> 'sub'))
    )
  );

create policy "sprint_lp_events_select" on sprint_lp_events
  for select using (
    sprint_id in (
      select id from sprints where
        org_id is null or org_id in (select org_id from org_members where user_id = (auth.jwt() ->> 'sub'))
    )
  );

create policy "sprint_angle_results_select" on sprint_angle_results
  for select using (
    sprint_id in (
      select id from sprints where
        org_id is null or org_id in (select org_id from org_members where user_id = (auth.jwt() ->> 'sub'))
    )
  );

-- Service-role-only inserts (no public path)
create policy "sprint_campaigns_insert" on sprint_campaigns for insert with check (true);
create policy "sprint_campaigns_update" on sprint_campaigns for update using (true);
create policy "sprint_ads_insert" on sprint_ads for insert with check (true);
create policy "sprint_ads_update" on sprint_ads for update using (true);
create policy "sprint_metrics_insert" on sprint_metrics for insert with check (true);
create policy "sprint_lp_events_insert" on sprint_lp_events for insert with check (true);
create policy "sprint_angle_results_insert" on sprint_angle_results for insert with check (true);
create policy "sprint_angle_results_update" on sprint_angle_results for update using (true);
create policy "capi_processed_insert" on capi_processed_events for insert with check (true);
create policy "capi_processed_select" on capi_processed_events for select using (false);

-- ── 9. updated_at triggers ────────────────────────────────────────────────

drop trigger if exists sprint_campaigns_updated_at on sprint_campaigns;
create trigger sprint_campaigns_updated_at
  before update on sprint_campaigns
  for each row execute function update_updated_at_column();

drop trigger if exists sprint_ads_updated_at on sprint_ads;
create trigger sprint_ads_updated_at
  before update on sprint_ads
  for each row execute function update_updated_at_column();
