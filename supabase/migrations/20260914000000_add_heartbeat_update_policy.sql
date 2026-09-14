-- Note: the original system_heartbeat migration recorded this column as
-- pinged_at, but the live database has always had it as last_pinged_at.
-- This file and all future references use the real column name.
--
-- Backfills, in the migration history, a policy + grant already applied
-- live via the SQL Editor. Checking last_pinged_at directly showed it
-- frozen at its original seed value through two weeks of "successful"
-- scheduled keep-alive runs: every prior ping was a pure SELECT, and reads
-- don't reliably register as activity for Supabase's pause detector the
-- way a write does. This lets the anon key update the same heartbeat row
-- instead of only reading it.

create policy "anon can update heartbeat"
  on public.system_heartbeat
  for update
  to anon
  using (true)
  with check (true);

grant update on public.system_heartbeat to anon;
