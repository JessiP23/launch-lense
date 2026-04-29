-- Post-sprint orchestration: SpreadsheetAgent → OutreachAgent → SlackAgent
-- JSON only — no raw contact emails persisted server-side by convention (application layer).

alter table sprints add column if not exists post_sprint jsonb default '{}'::jsonb;
alter table sprints add column if not exists integrations jsonb default '{}'::jsonb;

comment on column sprints.post_sprint is 'Spreadsheet/outreach/slack agent summaries & phase (no raw contact list)';
comment on column sprints.integrations is 'OAuth connection flags + sheet reference + Slack channel preference';
