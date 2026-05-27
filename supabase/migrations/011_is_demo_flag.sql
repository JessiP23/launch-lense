-- Add is_demo flag to sprints table for demo data management
-- This allows demo data to be purged before production use

alter table sprints add column if not exists is_demo boolean default false;

-- Add index for faster demo data queries
create index if not exists idx_sprints_is_demo on sprints(is_demo);

-- Add comment
comment on column sprints.is_demo is 'Flag to identify demo/test data that should be purged before production';
