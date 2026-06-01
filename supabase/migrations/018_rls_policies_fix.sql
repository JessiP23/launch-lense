-- LaunchLense RLS Policies Fix — Data security per spec
--
-- This migration fixes RLS policies to match the spec:
-- - signal_benchmarks: READ ONLY for authenticated users, no writes except service role
-- - sprint_signals: users see only their own signals (by org_id)
-- - sprints: users see only their own org's sprints
-- - data_exports: audit logging for benchmark access

-- ── 1. Fix signal_benchmarks RLS ───────────────────────────────────────────────────
-- READ ONLY for authenticated users, no writes except service role

drop policy if exists signal_benchmarks_no_public_select on signal_benchmarks;
drop policy if exists signal_benchmarks_no_public_modify on signal_benchmarks;

drop policy if exists signal_benchmarks_authenticated_select on signal_benchmarks;
create policy signal_benchmarks_authenticated_select
  on signal_benchmarks for select
  using (auth.role() = 'authenticated');

drop policy if exists signal_benchmarks_service_insert on signal_benchmarks;
create policy signal_benchmarks_service_insert
  on signal_benchmarks for insert
  with check (auth.role() = 'service_role');

drop policy if exists signal_benchmarks_service_update on signal_benchmarks;
create policy signal_benchmarks_service_update
  on signal_benchmarks for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 2. Fix sprint_signals RLS ────────────────────────────────────────────────────
-- Users see only their own signals (by org_id match)

drop policy if exists sprint_signals_no_public_select on sprint_signals;
drop policy if exists sprint_signals_no_public_modify on sprint_signals;

drop policy if exists sprint_signals_own_org_select on sprint_signals;
create policy sprint_signals_own_org_select
  on sprint_signals for select
  using (
    sprint_id IN (
      SELECT id FROM sprints WHERE org_id = auth.jwt() ->> 'org_id'
    )
  );

drop policy if exists sprint_signals_service_insert on sprint_signals;
create policy sprint_signals_service_insert
  on sprint_signals for insert
  with check (auth.role() = 'service_role');

drop policy if exists sprint_signals_service_update on sprint_signals;
create policy sprint_signals_service_update
  on sprint_signals for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 3. Add RLS policies for sprints table (org_id-based access) ───────────────────

alter table sprints enable row level security;

drop policy if exists sprints_own_org_all on sprints;
create policy sprints_own_org_all
  on sprints for all
  using (org_id = auth.jwt() ->> 'org_id')
  with check (org_id = auth.jwt() ->> 'org_id');

drop policy if exists sprints_service_all on sprints;
create policy sprints_service_all
  on sprints for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 4. Add data_exports table for audit logging ──────────────────────────────────
-- Logs every time benchmark data is accessed externally

create table if not exists data_exports (
  id uuid primary key default gen_random_uuid(),
  
  -- Access context
  accessed_by text,              -- service role identifier
  accessed_at timestamptz default now(),
  query_type text,              -- e.g., 'benchmarks_read', 'sprint_signals_read'
  row_count integer,
  
  -- Request context
  user_id uuid,                 -- user who triggered the access (if applicable)
  org_id uuid,                  -- org context (if applicable)
  resource_type text,           -- e.g., 'signal_benchmarks', 'sprint_signals'
  
  -- Metadata
  metadata jsonb default '{}'::jsonb
);

create index if not exists idx_data_exports_accessed_at on data_exports(accessed_at desc);
create index if not exists idx_data_exports_user_id on data_exports(user_id);
create index if not exists idx_data_exports_org_id on data_exports(org_id);
create index if not exists idx_data_exports_query_type on data_exports(query_type);

-- RLS for data_exports: service role only
alter table data_exports enable row level security;

drop policy if exists data_exports_no_public_select on data_exports;
create policy data_exports_no_public_select
  on data_exports for select using (false);

drop policy if exists data_exports_no_public_modify on data_exports;
create policy data_exports_no_public_modify
  on data_exports for all using (false) with check (false);

drop policy if exists data_exports_service_insert on data_exports;
create policy data_exports_service_insert
  on data_exports for insert
  with check (auth.role() = 'service_role');

drop policy if exists data_exports_service_select on data_exports;
create policy data_exports_service_select
  on data_exports for select
  using (auth.role() = 'service_role');

-- ── 5. Add privacy comments to benchmark tables ───────────────────────────────────

comment on table signal_benchmarks is 'PRIVACY: This table contains aggregated data only. No individual sprint or org data is stored here. Metrics are averaged across multiple sprints per vertical+channel combination.';

comment on table sprint_signals is 'PRIVACY: Individual sprint signals are only accessible to the sprint owner (by org_id). Aggregated benchmarks do not contain personally identifiable information.';

comment on table signal_patterns is 'PRIVACY: This table contains aggregated angle archetype performance patterns. No individual sprint, org, or idea data is stored here.';
