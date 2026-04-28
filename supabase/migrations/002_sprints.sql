-- LaunchLense v2 — Sprint Orchestration Schema
-- Adds: sprints table, sprint_events table, per-channel healthgate snapshots

-- ── Sprints ────────────────────────────────────────────────────────────────

create table if not exists sprints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations on delete set null,
  idea text not null,
  state text not null default 'IDLE'
    check (state in (
      'IDLE','GENOME_RUNNING','GENOME_DONE',
      'HEALTHGATE_RUNNING','HEALTHGATE_DONE',
      'ANGLES_RUNNING','ANGLES_DONE',
      'LANDING_RUNNING','LANDING_DONE',
      'CAMPAIGN_RUNNING','CAMPAIGN_MONITORING',
      'VERDICT_GENERATING','COMPLETE','BLOCKED'
    )),
  active_channels text[] not null default '{}',
  budget_cents int not null default 50000,
  blocked_reason text,
  -- Agent outputs (stored as JSONB — each agent writes its own key)
  genome jsonb,
  healthgate jsonb,
  angles jsonb,
  landing jsonb,
  campaign jsonb,
  verdict jsonb,
  report jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Sprint Events (audit + monitoring log) ─────────────────────────────────

create table if not exists sprint_events (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid references sprints on delete cascade,
  agent text not null,          -- 'genome' | 'healthgate' | 'angle' | 'campaign' | 'verdict' | 'report'
  event_type text not null,     -- 'started' | 'completed' | 'blocked' | 'poll' | 'pause'
  channel text,                 -- null for non-channel agents
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

create index if not exists idx_sprints_org on sprints(org_id, created_at desc);
create index if not exists idx_sprints_state on sprints(state);
create index if not exists idx_sprint_events_sprint on sprint_events(sprint_id, created_at desc);
create index if not exists idx_sprint_events_agent on sprint_events(agent, event_type);

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table sprints enable row level security;
alter table sprint_events enable row level security;

-- Sprints: org members can CRUD their own sprints
create policy "sprints_select" on sprints
  for select using (
    org_id in (select org_id from org_members where user_id = (auth.jwt()->>'sub'))
    or org_id is null  -- anonymous sprints (Genome standalone)
  );

create policy "sprints_insert" on sprints
  for insert with check (true);

create policy "sprints_update" on sprints
  for update using (true);

-- Sprint events: inherit sprint visibility
create policy "sprint_events_select" on sprint_events
  for select using (
    sprint_id in (
      select id from sprints where
        org_id in (select org_id from org_members where user_id = (auth.jwt()->>'sub'))
        or org_id is null
    )
  );

create policy "sprint_events_insert" on sprint_events
  for insert with check (true);

-- ── Updated_at trigger ─────────────────────────────────────────────────────

create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sprints_updated_at on sprints;
create trigger sprints_updated_at
  before update on sprints
  for each row execute function update_updated_at_column();
