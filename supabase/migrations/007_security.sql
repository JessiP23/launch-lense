-- LaunchLense v7 — Security hardening
-- 1. Fix permissive sprint INSERT/UPDATE RLS policies
-- 2. Fix permissive sprint_events INSERT policy
-- 3. Add vault_id column to ad_accounts (token encryption migration path)
-- 4. Add INSERT RLS policies for tests, health_snapshots, annotations, events

-- ── 1. Fix sprint RLS ───────────────────────────────────────────────────

-- Remove the overly-permissive policies
drop policy if exists "sprints_insert" on sprints;
drop policy if exists "sprints_update" on sprints;

-- INSERT: only allow when org_id is NULL (anonymous Genome runs) OR caller is org member
create policy "sprints_insert" on sprints
  for insert with check (
    org_id is null
    or org_id in (
      select org_id from org_members
      where user_id = (auth.jwt() ->> 'sub')
    )
  );

-- UPDATE: only allow when sprint belongs to caller's org or is anonymous
create policy "sprints_update" on sprints
  for update using (
    org_id is null
    or org_id in (
      select org_id from org_members
      where user_id = (auth.jwt() ->> 'sub')
    )
  );

-- ── 2. Fix sprint_events RLS ─────────────────────────────────────────────

drop policy if exists "sprint_events_insert" on sprint_events;

-- INSERT: only allow for sprints the caller owns
create policy "sprint_events_insert" on sprint_events
  for insert with check (
    sprint_id in (
      select id from sprints where
        org_id is null
        or org_id in (
          select org_id from org_members
          where user_id = (auth.jwt() ->> 'sub')
        )
    )
  );

-- ── 3. Add vault_id column to ad_accounts ────────────────────────────────
-- Migration path: new tokens will write vault_id; code resolves via get_secret().
-- access_token column deprecated but kept for backward compat during transition.

alter table ad_accounts
  add column if not exists vault_id uuid,
  add column if not exists token_updated_at timestamptz;

comment on column ad_accounts.vault_id is
  'Supabase Vault secret ID for the encrypted access token. Use get_secret(vault_id) to resolve.';

comment on column ad_accounts.access_token is
  'DEPRECATED: raw token fallback for dev/sandbox. vault_id takes precedence in production.';

-- ── 4. INSERT policies for remaining tables ──────────────────────────────

-- Tests: org members can insert
drop policy if exists "tests_insert" on tests;
create policy "tests_insert" on tests
  for insert with check (
    org_id in (
      select org_id from org_members
      where user_id = (auth.jwt() ->> 'sub')
    )
  );

-- Health snapshots: org members can insert via their accounts
drop policy if exists "health_snapshots_insert" on health_snapshots;
create policy "health_snapshots_insert" on health_snapshots
  for insert with check (
    ad_account_id in (
      select id from ad_accounts where org_id in (
        select org_id from org_members
        where user_id = (auth.jwt() ->> 'sub')
      )
    )
  );

-- Annotations: org members can insert on their tests
drop policy if exists "annotations_insert" on annotations;
create policy "annotations_insert" on annotations
  for insert with check (
    test_id in (
      select id from tests where org_id in (
        select org_id from org_members
        where user_id = (auth.jwt() ->> 'sub')
      )
    )
  );

-- Events: org members can insert on their tests
drop policy if exists "events_insert" on events;
create policy "events_insert" on events
  for insert with check (
    test_id in (
      select id from tests where org_id in (
        select org_id from org_members
        where user_id = (auth.jwt() ->> 'sub')
      )
    )
  );

-- ── 5. Indexes for RLS query performance ─────────────────────────────────

-- Speeds up the repeated org_members lookup in all RLS policies
create index if not exists idx_org_members_user_id on org_members(user_id);
create index if not exists idx_org_members_org_user on org_members(org_id, user_id);

-- Speeds up sprint ownership lookups
create index if not exists idx_sprints_org_id on sprints(org_id);
create index if not exists idx_tests_org_id on tests(org_id);
