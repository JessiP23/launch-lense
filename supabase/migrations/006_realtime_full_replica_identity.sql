-- Enable Supabase Realtime on the sprints table and set REPLICA IDENTITY FULL
-- so that UPDATE events carry the complete new row (not just changed columns).
-- Without REPLICA IDENTITY FULL, payload.new only contains the primary key.

-- 1. Tell Postgres to include all columns in the WAL UPDATE record
alter table sprints replica identity full;

-- 2. Add the sprints table to the supabase_realtime publication
--    (Supabase creates this publication by default; adding tables is idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sprints'
  ) then
    alter publication supabase_realtime add table sprints;
  end if;
end
$$;
