-- LaunchLense v10 — Editable creative approval workflow
--
-- Goal: turn AI-generated angles into editable deployable ad assets. Adds:
--   1. Two new sprint states for the approval gate (USER_REVIEW_REQUIRED,
--      CREATIVE_APPROVED). All existing states kept verbatim — no rewrite.
--   2. sprint_creatives table — one row per (sprint, angle, platform) holds
--      the editable copy + uploaded asset references + approval status. Keeps
--      sprints.angles JSONB lean by moving editable per-creative content out.
--
-- Conventions:
--   * 1:N from sprints; cascade delete with the sprint.
--   * Status state machine matches the orchestrator spec:
--       draft → reviewing → approved | rejected | deploying → deployed | failed.
--   * image_hash / video_id are stored alongside the source URLs so the Meta
--     deployment pipeline can re-use uploaded assets across rebuilds.
--   * RLS: scoped to the owning sprint via the existing sprint_creatives_owner
--     helper (created below). Service-role bypass remains.

-- ── 1. Expand sprint state CHECK with approval-gate states ────────────────

alter table sprints drop constraint if exists sprints_state_check;

alter table sprints add constraint sprints_state_check check (state in (
  'IDLE','GENOME_RUNNING','GENOME_DONE',
  'HEALTHGATE_RUNNING','HEALTHGATE_DONE',
  'PAYMENT_PENDING','PAYMENT_CONFIRMED',
  'ANGLES_RUNNING','ANGLES_DONE',
  -- v10 approval gate. ANGLES_DONE keeps its meaning (drafts ready); when the
  -- orchestrator surfaces them for review we transition to USER_REVIEW_REQUIRED;
  -- once at least one creative per active channel is approved we move to
  -- CREATIVE_APPROVED and the launcher unlocks (still PAUSED until the user
  -- presses Launch — see /api/sprint/[id]/campaign/activate).
  'USER_REVIEW_REQUIRED','CREATIVE_APPROVED',
  'LANDING_RUNNING','LANDING_DONE',
  'CAMPAIGN_CREATING','CAMPAIGN_RUNNING','CAMPAIGN_MONITORING','MONITORING',
  'VERDICT_GENERATING','VERDICT_RUNNING','COMPLETE','BLOCKED'
));

-- ── 2. sprint_creatives ───────────────────────────────────────────────────

create table if not exists sprint_creatives (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,

  -- Logical identity: one creative per angle × platform.
  angle_id text not null,
  platform text not null check (platform in ('meta','google','linkedin','tiktok')),

  -- Approval state machine.
  status text not null default 'draft' check (status in (
    'draft',       -- AI-generated, not yet reviewed
    'reviewing',   -- user has started editing
    'approved',    -- user signed off; deploy unlocked for this creative
    'rejected',    -- user explicitly rejected; will be excluded from deploy
    'deploying',   -- create-campaign.ts has begun pushing this to Meta
    'deployed',    -- Meta returned a creative_id, ad_id, etc.
    'failed'       -- deployment failed; user can retry
  )),

  -- Editable copy fields. Channels share a superset; nullable so each platform
  -- only fills what it needs (e.g. Meta uses headline+primary_text+description,
  -- TikTok uses hook+overlay_text).
  headline text,
  primary_text text,
  description text,
  cta text,
  display_link text,
  hook text,
  overlay_text text,
  callout text,
  audience_label text,

  -- Asset references. Source URLs live in Supabase Storage; image_hash /
  -- video_id are populated by the deployer after a successful Meta upload.
  image_url text,
  video_url text,
  image_hash text,
  video_id text,

  -- Meta object references — populated by lib/meta/create-campaign.ts.
  creative_id text,
  ad_id text,
  adset_id text,

  -- Free-form metadata so future agents (LandingAgent, VerdictAgent) can
  -- attach derived values without another migration.
  meta jsonb not null default '{}'::jsonb,

  -- Policy scan result — refreshed every time the creative is saved or
  -- approved; deploy is blocked when severity = 'block'.
  policy_severity text check (policy_severity in ('clean','warn','block')),
  policy_issues   jsonb,
  policy_scanned_at timestamptz,

  approved_at timestamptz,
  approved_by text,
  rejected_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (sprint_id, angle_id, platform)
);

create index if not exists idx_sprint_creatives_sprint
  on sprint_creatives(sprint_id);
create index if not exists idx_sprint_creatives_status
  on sprint_creatives(sprint_id, status);
create index if not exists idx_sprint_creatives_platform
  on sprint_creatives(sprint_id, platform);

-- ── 3. updated_at trigger ─────────────────────────────────────────────────
-- Reuse the existing touch_updated_at function if it exists; create a local
-- one otherwise. We do this with conditional execution so the migration is
-- safe in fresh databases and in databases that already have it.

create or replace function sprint_creatives_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sprint_creatives_updated_at on sprint_creatives;
create trigger trg_sprint_creatives_updated_at
  before update on sprint_creatives
  for each row execute function sprint_creatives_touch_updated_at();

-- ── 4. RLS ────────────────────────────────────────────────────────────────
-- Same model as sprint_campaigns: service-role bypass, no public read/write.
-- All access goes through the orchestrator and API routes using the service
-- client. If we later expose direct client reads we'll add a policy keyed on
-- the sprint's org membership.

alter table sprint_creatives enable row level security;

drop policy if exists sprint_creatives_no_public_select on sprint_creatives;
create policy sprint_creatives_no_public_select
  on sprint_creatives for select using (false);

drop policy if exists sprint_creatives_no_public_modify on sprint_creatives;
create policy sprint_creatives_no_public_modify
  on sprint_creatives for all using (false) with check (false);
