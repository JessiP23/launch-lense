-- LaunchLense — Autopilot Engine Tables
--
-- Autopilot manages campaign spend, pauses underperforming channels, and rotates
-- creatives automatically based on performance metrics. These tables store the
-- configuration, decisions, creative pool, and budget tracking data.

-- ── 1. autopilot_configs ─────────────────────────────────────────────────────
-- Per-sprint autopilot configuration. One row per sprint.

create table if not exists autopilot_configs (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,
  
  -- Configuration
  enabled boolean default false,
  daily_budget_cents integer not null default 5000,
  total_budget_cents integer not null default 50000,
  target_cpa_cents integer,
  target_ctr_floor numeric(5,4),
  channels text[] default '{}',
  auto_pause_on_underperform boolean default true,
  auto_scale_on_overperform boolean default false,
  
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure one config per sprint
  constraint autopilot_configs_unique unique (sprint_id)
);

create index if not exists idx_autopilot_configs_sprint_id on autopilot_configs(sprint_id);
create index if not exists idx_autopilot_configs_enabled on autopilot_configs(enabled);

-- ── 2. autopilot_decisions ────────────────────────────────────────────────────
-- Log of all autopilot decisions made during a sprint.

create table if not exists autopilot_decisions (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,
  channel text not null,
  decision_type text not null,
  trigger text not null,
  metrics_at_decision jsonb,
  action_taken jsonb,
  outcome_after_1h jsonb,
  reasoning text,
  created_at timestamptz default now()
);

create index if not exists idx_autopilot_decisions_sprint_id on autopilot_decisions(sprint_id);
create index if not exists idx_autopilot_decisions_channel on autopilot_decisions(channel);
create index if not exists idx_autopilot_decisions_created_at on autopilot_decisions(created_at desc);

-- ── 3. autopilot_creative_pool ─────────────────────────────────────────────────
-- Pool of creatives available for rotation. Tracks fatigue and impressions served.

create table if not exists autopilot_creative_pool (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,
  creative_id uuid references sprint_creatives(id) on delete cascade,
  channel text not null,
  fatigue_score numeric(4,2) default 0,
  impressions_served integer default 0,
  last_served_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_autopilot_creative_pool_sprint_id on autopilot_creative_pool(sprint_id);
create index if not exists idx_autopilot_creative_pool_channel on autopilot_creative_pool(channel);
create index if not exists idx_autopilot_creative_pool_is_active on autopilot_creative_pool(is_active);

-- ── 4. autopilot_budget_log ────────────────────────────────────────────────────
-- Daily budget tracking per sprint and channel.

create table if not exists autopilot_budget_log (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,
  channel text not null,
  date date not null,
  spend_cents integer default 0,
  impressions integer default 0,
  clicks integer default 0,
  conversions integer default 0,
  
  -- Ensure one row per sprint/channel/date
  constraint autopilot_budget_log_unique unique (sprint_id, channel, date)
);

create index if not exists idx_autopilot_budget_log_sprint_id on autopilot_budget_log(sprint_id);
create index if not exists idx_autopilot_budget_log_date on autopilot_budget_log(date);

-- ── 5. RLS ─────────────────────────────────────────────────────────────────

alter table autopilot_configs enable row level security;
alter table autopilot_decisions enable row level security;
alter table autopilot_creative_pool enable row level security;
alter table autopilot_budget_log enable row level security;

-- No public select/modify policies (service-role only)
drop policy if exists autopilot_configs_no_public_select on autopilot_configs;
create policy autopilot_configs_no_public_select
  on autopilot_configs for select using (false);

drop policy if exists autopilot_configs_no_public_modify on autopilot_configs;
create policy autopilot_configs_no_public_modify
  on autopilot_configs for all using (false) with check (false);

drop policy if exists autopilot_decisions_no_public_select on autopilot_decisions;
create policy autopilot_decisions_no_public_select
  on autopilot_decisions for select using (false);

drop policy if exists autopilot_decisions_no_public_modify on autopilot_decisions;
create policy autopilot_decisions_no_public_modify
  on autopilot_decisions for all using (false) with check (false);

drop policy if exists autopilot_creative_pool_no_public_select on autopilot_creative_pool;
create policy autopilot_creative_pool_no_public_select
  on autopilot_creative_pool for select using (false);

drop policy if exists autopilot_creative_pool_no_public_modify on autopilot_creative_pool;
create policy autopilot_creative_pool_no_public_modify
  on autopilot_creative_pool for all using (false) with check (false);

drop policy if exists autopilot_budget_log_no_public_select on autopilot_budget_log;
create policy autopilot_budget_log_no_public_select
  on autopilot_budget_log for select using (false);

drop policy if exists autopilot_budget_log_no_public_modify on autopilot_budget_log;
create policy autopilot_budget_log_no_public_modify
  on autopilot_budget_log for all using (false) with check (false);
