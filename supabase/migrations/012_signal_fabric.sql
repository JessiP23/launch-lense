-- LaunchLense Signal Fabric — Cross-sprint learning layer
--
-- This migration creates the Signal Fabric tables that enable LaunchLense to
-- learn from every sprint and improve prediction accuracy over time.
--
-- Tables:
--   1. signal_benchmarks — aggregated performance metrics per vertical+channel
--   2. sprint_signals — individual sprint performance records
--   3. signal_patterns — angle archetype performance patterns
--
-- The Signal Fabric is the proprietary data asset that differentiates LaunchLense
-- from competitors who only provide AI opinions without real market behavior.

-- ── 1. signal_benchmarks ─────────────────────────────────────────────────────
-- Aggregated benchmarks for each vertical+channel combination. These are
-- recalculated after every sprint completes and serve as the ground truth for
-- GenomeAgent pre-screening and VerdictAgent calibration.

create table if not exists signal_benchmarks (
  id uuid primary key default gen_random_uuid(),
  vertical text not null,
  channel text not null check (channel in ('meta','google','linkedin','tiktok')),
  
  -- Aggregated performance metrics
  avg_ctr numeric(6,4),           -- average click-through rate (0.0000 to 1.0000)
  avg_cpc numeric(8,2),          -- average cost per click in cents
  avg_cvr numeric(6,4),           -- average conversion rate (0.0000 to 1.0000)
  avg_cpa numeric(8,2),          -- average cost per acquisition in cents
  
  -- Metadata
  sample_size integer default 0,  -- number of sprints in this aggregate
  last_updated timestamptz default now(),
  
  -- Ensure one benchmark row per vertical+channel
  constraint signal_benchmarks_unique unique (vertical, channel)
);

create index if not exists idx_signal_benchmarks_vertical
  on signal_benchmarks(vertical);
create index if not exists idx_signal_benchmarks_channel
  on signal_benchmarks(channel);

-- ── 2. sprint_signals ────────────────────────────────────────────────────────
-- Individual sprint performance records. One row per sprint per active channel.
-- These are the raw data points that feed into benchmark recalculations.

create table if not exists sprint_signals (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,
  
  -- Classification
  vertical text not null,
  channel text not null check (channel in ('meta','google','linkedin','tiktok')),
  
  -- Performance metrics
  ctr numeric(6,4),
  cpc numeric(8,2),
  cvr numeric(6,4),
  cpa numeric(8,2),
  
  -- Verdict and pattern data
  verdict text check (verdict in ('GO','ITERATE','NO-GO')),
  angle_archetype text,
  
  -- Metadata
  created_at timestamptz default now()
);

create index if not exists idx_sprint_signals_sprint_id
  on sprint_signals(sprint_id);
create index if not exists idx_sprint_signals_vertical
  on sprint_signals(vertical);
create index if not exists idx_sprint_signals_channel
  on sprint_signals(channel);
create index if not exists idx_sprint_signals_verdict
  on sprint_signals(verdict);
create index if not exists idx_sprint_signals_created_at
  on sprint_signals(created_at desc);

-- ── 3. signal_patterns ───────────────────────────────────────────────────────
-- Angle archetype performance patterns. Shows which archetypes perform
-- above/below benchmark for each vertical+channel combination.

create table if not exists signal_patterns (
  id uuid primary key default gen_random_uuid(),
  vertical text not null,
  channel text not null check (channel in ('meta','google','linkedin','tiktok')),
  angle_archetype text not null check (angle_archetype in ('PAIN','ASPIRATION','SOCIAL_PROOF','CURIOSITY','AUTHORITY')),
  
  -- Performance lift relative to benchmark
  avg_ctr_lift numeric(6,4),     -- how much above/below benchmark this archetype performs
  
  -- Metadata
  sample_size integer default 0,
  last_updated timestamptz default now(),
  
  -- Ensure one pattern row per vertical+channel+archetype
  constraint signal_patterns_unique unique (vertical, channel, angle_archetype)
);

create index if not exists idx_signal_patterns_vertical
  on signal_patterns(vertical);
create index if not exists idx_signal_patterns_channel
  on signal_patterns(channel);
create index if not exists idx_signal_patterns_archetype
  on signal_patterns(angle_archetype);

-- ── 4. RLS ─────────────────────────────────────────────────────────────────
-- Signal tables are service-role only. No public access. All reads/writes go
-- through the signal-fabric.ts server functions.

alter table signal_benchmarks enable row level security;
alter table sprint_signals enable row level security;
alter table signal_patterns enable row level security;

-- No public select/modify policies
drop policy if exists signal_benchmarks_no_public_select on signal_benchmarks;
create policy signal_benchmarks_no_public_select
  on signal_benchmarks for select using (false);

drop policy if exists signal_benchmarks_no_public_modify on signal_benchmarks;
create policy signal_benchmarks_no_public_modify
  on signal_benchmarks for all using (false) with check (false);

drop policy if exists sprint_signals_no_public_select on sprint_signals;
create policy sprint_signals_no_public_select
  on sprint_signals for select using (false);

drop policy if exists sprint_signals_no_public_modify on sprint_signals;
create policy sprint_signals_no_public_modify
  on sprint_signals for all using (false) with check (false);

drop policy if exists signal_patterns_no_public_select on signal_patterns;
create policy signal_patterns_no_public_select
  on signal_patterns for select using (false);

drop policy if exists signal_patterns_no_public_modify on signal_patterns;
create policy signal_patterns_no_public_modify
  on signal_patterns for all using (false) with check (false);
