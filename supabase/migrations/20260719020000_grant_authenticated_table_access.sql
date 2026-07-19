-- RLS policies alone don't grant access: Postgres checks the underlying
-- table-level GRANTs before it ever evaluates a row's RLS policies. The
-- initial schema migration enabled RLS and added admin-only policies on
-- every domain table, but never GRANTed the authenticated role base
-- SELECT/INSERT/UPDATE/DELETE privileges on those tables, so every request
-- from a signed-in user failed with "permission denied for table X" before
-- RLS (and is_admin()) ever got a chance to run.
--
-- These grants only lift the table-level check; is_admin() and the
-- existing RLS policies still gate which rows can actually be read or
-- written. A non-admin authenticated user remains blocked by RLS exactly
-- as before.

grant select, insert, update, delete on
  public.clusters,
  public.members,
  public.slots,
  public.slot_members,
  public.cycles,
  public.payments
to authenticated;
