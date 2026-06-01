-- LaunchLense — Add ICP Discovery and GTM Package columns to sprints table
--
-- This migration adds JSONB columns for storing ICP discovery results and
-- GTM package outputs from the post-sprint analysis agents.

alter table sprints add column if not exists icp_discovery jsonb;
alter table sprints add column if not exists gtm_package jsonb;

-- Add comments for documentation
comment on column sprints.icp_discovery is 'ICP discovery output from post-sprint analysis — segments derived from real click data';
comment on column sprints.gtm_package is 'GTM starter package output — 30/60/90 day plan, next headlines, budget recommendations';
