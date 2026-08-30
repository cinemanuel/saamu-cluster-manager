-- Backfills, in the migration history, a table already created live via the
-- SQL Editor: a dedicated target for the GitHub Actions keep-alive ping
-- (.github/workflows/supabase-keepalive.yml), which needs a real, cheap
-- database read the anon key can make without depending on any app table's
-- RLS or grants. The Auth health endpoint (/auth/v1/health) was tried first
-- but doesn't count as database activity for Supabase's pause detector.
--
-- Deliberately holds no real data -- one seed row, nothing else -- so this
-- table can be freely, publicly readable without exposing anything.

create table public.system_heartbeat (
  -- Fixed at 1, not a generated uuid -- the primary key default means this
  -- table can only ever hold the one row (a second insert without an
  -- explicit different id would collide on the same default and fail).
  id smallint primary key default 1,
  pinged_at timestamptz not null default now()
);

alter table public.system_heartbeat enable row level security;

create policy "Anyone can read the heartbeat"
  on public.system_heartbeat for select
  using (true);

-- RLS alone isn't enough: Postgres also requires an explicit table-level
-- grant for the anon role, independent of any RLS policy on the table.
grant select on public.system_heartbeat to anon;

insert into public.system_heartbeat default values;
