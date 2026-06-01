-- LaunchLense — ICP Discovery + GTM Package fields
-- Adds: icp_discovery and gtm_package JSONB columns to sprints table
-- These fields store behavioral ICP analysis and GTM starter plans generated after sprint completion

-- ── Add new columns to sprints table ─────────────────────────────────────────

alter table sprints 
  add column if not exists icp_discovery jsonb,
  add column if not exists gtm_package jsonb;

-- ── Add comments for documentation ─────────────────────────────────────────────

comment on column sprints.icp_discovery is 'ICP Discovery Engine output — behavioral customer segment analysis derived from campaign performance, genome data, and market signals';
comment on column sprints.gtm_package is 'GTM Package output — 30/60/90 day GTM plan, ad headlines, budget scaling recommendations, and competitive wedge generated after sprint completion';
