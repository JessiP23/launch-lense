-- LaunchLense v0.1 Schema
-- Run this against your Supabase project

-- Enable required extensions
create extension if not exists "pgcrypto";

-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Org members
create table org_members (
  org_id uuid references organizations on delete cascade,
  user_id text not null,
  role text not null default 'member',
  primary key (org_id, user_id)
);

-- Ad accounts
create table ad_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations on delete cascade,
  platform text not null default 'meta',
  account_id text unique not null,
  access_token text, -- encrypted via Vault in production
  name text,
  last_checked_at timestamptz
);

-- Health snapshots
create table health_snapshots (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid references ad_accounts on delete cascade,
  score int not null,
  status text not null check (status in ('red', 'yellow', 'green')),
  checks jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Tests (validation campaigns)
create table tests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations on delete cascade,
  ad_account_id uuid references ad_accounts on delete cascade,
  name text not null,
  status text not null default 'draft',
  budget_cents int not null default 50000,
  campaign_id text,
  adset_id text,
  ad_id text,
  creative_id text,
  lp_url text,
  lp_json jsonb,
  lp_variant int default 1,
  vertical text default 'saas',
  idea text,
  audience text,
  offer text,
  angles jsonb,
  image_url text,
  share_token text unique,
  verdict text,
  verdict_pdf_url text,
  created_at timestamptz default now()
);

-- Events (metrics, anomalies, verdicts)
create table events (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references tests on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Annotations (audit log)
create table annotations (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references tests on delete cascade,
  author text not null,
  message text not null,
  created_at timestamptz default now()
);

-- Benchmarks
create table benchmarks (
  vertical text primary key,
  avg_ctr float not null,
  avg_cvr float not null,
  avg_cpa_cents int not null,
  sample_size int not null default 0
);

-- Seed benchmarks
insert into benchmarks (vertical, avg_ctr, avg_cvr, avg_cpa_cents, sample_size) values
  ('saas', 0.012, 0.025, 4500, 1200),
  ('ecommerce', 0.018, 0.032, 3200, 2400),
  ('health', 0.009, 0.018, 5800, 800),
  ('fintech', 0.011, 0.021, 5200, 600),
  ('education', 0.014, 0.028, 3800, 950),
  ('marketplace', 0.013, 0.022, 4800, 500);

-- Enable RLS on all tables
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table ad_accounts enable row level security;
alter table health_snapshots enable row level security;
alter table tests enable row level security;
alter table events enable row level security;
alter table annotations enable row level security;
alter table benchmarks enable row level security;

-- RLS Policies
-- Organizations: members can read their orgs
create policy "org_members_read" on organizations
  for select using (
    id in (select org_id from org_members where user_id = (auth.jwt()->>'sub'))
  );

-- Org members: can read own memberships
create policy "org_members_select" on org_members
  for select using (user_id = (auth.jwt()->>'sub'));

-- Ad accounts: org members can read
create policy "ad_accounts_select" on ad_accounts
  for select using (
    org_id in (select org_id from org_members where user_id = (auth.jwt()->>'sub'))
  );

-- Health snapshots: via ad account org
create policy "health_snapshots_select" on health_snapshots
  for select using (
    ad_account_id in (
      select id from ad_accounts where org_id in (
        select org_id from org_members where user_id = (auth.jwt()->>'sub')
      )
    )
  );

-- Tests: org members can read
create policy "tests_select" on tests
  for select using (
    org_id in (select org_id from org_members where user_id = (auth.jwt()->>'sub'))
  );

-- Events: via test org
create policy "events_select" on events
  for select using (
    test_id in (
      select id from tests where org_id in (
        select org_id from org_members where user_id = (auth.jwt()->>'sub')
      )
    )
  );

-- Annotations: via test org
create policy "annotations_select" on annotations
  for select using (
    test_id in (
      select id from tests where org_id in (
        select org_id from org_members where user_id = (auth.jwt()->>'sub')
      )
    )
  );

-- Benchmarks: public read
create policy "benchmarks_read" on benchmarks
  for select using (true);

-- Indexes
create index idx_health_snapshots_account on health_snapshots(ad_account_id, created_at desc);
create index idx_tests_org on tests(org_id, created_at desc);
create index idx_tests_status on tests(status);
create index idx_events_test on events(test_id, created_at desc);
create index idx_events_type on events(type);
create index idx_annotations_test on annotations(test_id, created_at desc);

-- Vault wrappers (public RPC) for server-side token storage/retrieval
create extension if not exists supabase_vault with schema vault;

create or replace function public.create_secret(secret text, name text)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_id uuid;
begin
  select vault.create_secret(secret, name, null) into secret_id;
  return secret_id;
end;
$$;

create or replace function public.get_secret(id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where decrypted_secrets.id = get_secret.id
  limit 1;
$$;

revoke all on function public.create_secret(text, text) from public;
revoke all on function public.get_secret(uuid) from public;
grant execute on function public.create_secret(text, text) to service_role;
grant execute on function public.get_secret(uuid) to service_role;
