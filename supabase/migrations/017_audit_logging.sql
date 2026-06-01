-- LaunchLense Audit Logging — Data security and access tracking
--
-- This migration creates the audit_log table to track data access and
-- modifications for compliance and security purposes.
--
-- The audit log captures:
-- - User access to sprint data
-- - Data exports (PDF reports, spreadsheets)
-- - System-level operations by service role
-- - Failed access attempts

-- ── 1. audit_log table ────────────────────────────────────────────────────────

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  
  -- Actor
  user_id uuid,              -- null for service role operations
  org_id uuid,               -- org context if applicable
  sprint_id uuid references sprints(id) on delete set null,
  
  -- Action
  action text not null check (action in (
    'SPRINT_READ',
    'SPRINT_EXPORT_PDF',
    'SPRINT_EXPORT_SPREADSHEET',
    'SPRINT_CREATE',
    'INTELLIGENCE_ACCESS',
    'SIGNAL_FABRIC_READ',
    'SIGNAL_FABRIC_WRITE',
    'SYSTEM_OPERATION'
  )),
  
  -- Details
  resource_type text,        -- e.g., 'sprint', 'signal_benchmarks', 'icp_discovery'
  resource_id text,          -- identifier of the resource accessed
  metadata jsonb default '{}'::jsonb,  -- additional context
  
  -- Result
  status text check (status in ('SUCCESS', 'FAILURE', 'UNAUTHORIZED')),
  error_message text,
  
  -- Timestamp
  created_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_audit_log_user_id on audit_log(user_id);
create index if not exists idx_audit_log_org_id on audit_log(org_id);
create index if not exists idx_audit_log_sprint_id on audit_log(sprint_id);
create index if not exists idx_audit_log_action on audit_log(action);
create index if not exists idx_audit_log_created_at on audit_log(created_at desc);
create index if not exists idx_audit_log_status on audit_log(status);

-- ── 2. RLS ─────────────────────────────────────────────────────────────────────
-- Audit log is service-role only. Users cannot read or modify audit entries.

alter table audit_log enable row level security;

-- No public select policy
drop policy if exists audit_log_no_public_select on audit_log;
create policy audit_log_no_public_select
  on audit_log for select using (false);

-- No public modify policy
drop policy if exists audit_log_no_public_modify on audit_log;
create policy audit_log_no_public_modify
  on audit_log for all using (false) with check (false);

-- Service role can insert (used by server-side logging functions)
drop policy if exists audit_log_service_insert on audit_log;
create policy audit_log_service_insert
  on audit_log for insert
  with check (auth.role() = 'service_role');

-- Service role can select (for admin dashboards)
drop policy if exists audit_log_service_select on audit_log;
create policy audit_log_service_select
  on audit_log for select
  using (auth.role() = 'service_role');

-- ── 3. Helper function for audit logging ────────────────────────────────────────

create or replace function log_audit_event(
  p_action text,
  p_user_id uuid default null,
  p_org_id uuid default null,
  p_sprint_id uuid default null,
  p_resource_type text default null,
  p_resource_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_status text default 'SUCCESS',
  p_error_message text default null
) returns uuid as $$
declare
  v_audit_id uuid;
begin
  insert into audit_log (
    user_id,
    org_id,
    sprint_id,
    action,
    resource_type,
    resource_id,
    metadata,
    status,
    error_message
  ) values (
    p_user_id,
    p_org_id,
    p_sprint_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata,
    p_status,
    p_error_message
  )
  returning id into v_audit_id;
  
  return v_audit_id;
end;
$$ language plpgsql security definer;

-- Grant execute on logging function to service role
grant execute on function log_audit_event to service_role;
