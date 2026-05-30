-- LaunchLense v10.1 — Policy Score Display
--
-- Adds a policy_score column to sprint_creatives table to enable at-a-glance
-- policy quality assessment. The score is computed as:
--   - Start at 100
--   - Subtract 30 for each 'error' severity issue
--   - Subtract 10 for each 'warning' severity issue
--   - Floor at 0
--
-- This score is displayed as a circular progress indicator in the creative editor
-- and as a compact badge in the creative approval workspace.

-- ── Add policy_score column to sprint_creatives ─────────────────────────────

alter table sprint_creatives
add column if not exists policy_score integer default 100 check (policy_score >= 0 and policy_score <= 100);

-- ── Create index for filtering by policy score ─────────────────────────────────

create index if not exists idx_sprint_creatives_policy_score
  on sprint_creatives(sprint_id, policy_score);

-- ── Backfill existing rows with computed policy scores ───────────────────────
-- For existing rows, compute the score based on existing policy_severity and policy_issues

update sprint_creatives
set policy_score = greatest(0, 100 -
  (case when policy_severity = 'block' then 30 else 0 end) *
  (case when jsonb_array_length(policy_issues) > 0 then jsonb_array_length(policy_issues) else 0 end) -
  (case when policy_severity = 'warn' then 10 else 0 end) *
  (case when jsonb_array_length(policy_issues) > 0 then jsonb_array_length(policy_issues) else 0 end)
)
where policy_score is null or policy_score = 100 and policy_issues is not null;
