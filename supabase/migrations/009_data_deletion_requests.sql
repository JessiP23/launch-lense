-- LaunchLense v9 — Data deletion request queue
--
-- Stores both self-serve requests (from /data-deletion form) and
-- Meta-initiated requests (from /api/meta/data-deletion callback). The
-- background worker processes rows where status is pending_cascade.
--
-- Schema is intentionally minimal — once the cascade completes we purge any
-- email/user references and only keep the audit envelope (confirmation_id,
-- status, timestamps) so we can answer status polls from Meta for 30 days.

create table if not exists data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_id text not null unique,
  email text,
  meta_user_id text,
  reason text,
  source text not null check (source in ('self_serve', 'meta_callback', 'admin')),
  status text not null default 'pending_verification' check (status in (
    'pending_verification',  -- waiting on user email click (self_serve only)
    'pending_cascade',       -- verified / queued
    'in_progress',           -- worker actively deleting
    'completed',
    'failed'
  )),
  verification_token uuid,                -- nullable for Meta-initiated
  requested_ip text,
  requested_user_agent text,
  error_message text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_data_deletion_requests_status
  on data_deletion_requests(status, created_at);
create index if not exists idx_data_deletion_requests_email
  on data_deletion_requests(email);
create index if not exists idx_data_deletion_requests_meta_user
  on data_deletion_requests(meta_user_id);

-- RLS: service role only. Confirmation-id lookups happen via the API which
-- uses the service client, so no public select policy is necessary.
alter table data_deletion_requests enable row level security;

create policy "data_deletion_requests_no_public_select"
  on data_deletion_requests
  for select
  using (false);

create policy "data_deletion_requests_no_public_modify"
  on data_deletion_requests
  for all
  using (false)
  with check (false);
