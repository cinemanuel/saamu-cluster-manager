-- Multi-tenancy with super-admin oversight.
--
-- Until now every admin_users row had equal access to every cluster
-- (a single-coordinator tool, per the Entry 1 comment). This makes
-- each cluster belong to exactly one coordinator, isolated from every
-- other coordinator's data, while a distinct super_admin role can
-- read across all coordinators for support/oversight but can never
-- write anything, anywhere — not even to a cluster it might somehow
-- end up "owning". No co-ownership, no ownership transfer: a
-- cluster's owner_id is set once at creation and never changes.

-- ---------------------------------------------------------------------
-- admin_users.role
-- ---------------------------------------------------------------------

alter table public.admin_users
  add column role text not null default 'coordinator'
  check (role in ('coordinator', 'super_admin'));

-- ---------------------------------------------------------------------
-- clusters.owner_id
-- Nullable first so existing rows can be backfilled, then locked to
-- NOT NULL — same pattern as the kyc_tier backfill in Entry 4.
-- ---------------------------------------------------------------------

alter table public.clusters
  add column owner_id uuid references auth.users (id);

do $$
declare
  v_fallback_owner uuid;
begin
  if exists (select 1 from public.clusters where owner_id is null) then
    select user_id into v_fallback_owner
    from public.admin_users
    order by created_at asc
    limit 1;

    if v_fallback_owner is null then
      raise exception 'Cannot backfill clusters.owner_id: admin_users is empty.';
    end if;

    update public.clusters set owner_id = v_fallback_owner where owner_id is null;
  end if;
end;
$$;

alter table public.clusters
  alter column owner_id set not null;

create index clusters_owner_id_idx on public.clusters (owner_id);

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function public.owns_cluster(p_cluster_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.clusters
    where id = p_cluster_id and owner_id = auth.uid()
  );
$$;

-- Resolves owner ids to emails for the "Owner" column on the clusters
-- list — the app can't query auth.users directly (no grants on that
-- schema for the authenticated role), and oversight is meaningless if
-- a super-admin can't tell whose data they're looking at. Gated on
-- the caller being an admin so this can't be used as a general email
-- lookup: the where clause evaluates false for every row (returning
-- no rows, not an error) when the caller isn't one.
create or replace function public.get_user_emails(p_user_ids uuid[])
returns table(id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select id, email from auth.users
  where public.is_admin()
    and (public.is_super_admin() or id = auth.uid())
    and id = any(p_user_ids);
$$;

-- ---------------------------------------------------------------------
-- RLS: replace the single "admin full access" policy on each domain
-- table with two — coordinators can do anything to their own data
-- (and only their own), super-admins can only ever SELECT, across
-- everyone's data.
-- ---------------------------------------------------------------------

drop policy "Admin full access to clusters" on public.clusters;

create policy "Coordinators manage their own clusters"
  on public.clusters for all
  using (public.is_admin() and not public.is_super_admin() and owner_id = auth.uid())
  with check (public.is_admin() and not public.is_super_admin() and owner_id = auth.uid());

create policy "Super admins can view all clusters"
  on public.clusters for select
  using (public.is_admin() and public.is_super_admin());

drop policy "Admin full access to members" on public.members;

create policy "Coordinators manage their own members"
  on public.members for all
  using (public.is_admin() and not public.is_super_admin() and public.owns_cluster(cluster_id))
  with check (public.is_admin() and not public.is_super_admin() and public.owns_cluster(cluster_id));

create policy "Super admins can view all members"
  on public.members for select
  using (public.is_admin() and public.is_super_admin());

drop policy "Admin full access to slots" on public.slots;

create policy "Coordinators manage their own slots"
  on public.slots for all
  using (public.is_admin() and not public.is_super_admin() and public.owns_cluster(cluster_id))
  with check (public.is_admin() and not public.is_super_admin() and public.owns_cluster(cluster_id));

create policy "Super admins can view all slots"
  on public.slots for select
  using (public.is_admin() and public.is_super_admin());

drop policy "Admin full access to slot_members" on public.slot_members;

create policy "Coordinators manage their own slot_members"
  on public.slot_members for all
  using (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster((select cluster_id from public.slots where id = slot_id))
  )
  with check (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster((select cluster_id from public.slots where id = slot_id))
    and (select cluster_id from public.members where id = member_id)
        = (select cluster_id from public.slots where id = slot_id)
  );

create policy "Super admins can view all slot_members"
  on public.slot_members for select
  using (public.is_admin() and public.is_super_admin());

drop policy "Admin full access to cycles" on public.cycles;

create policy "Coordinators manage their own cycles"
  on public.cycles for all
  using (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster(cluster_id)
  )
  with check (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster(cluster_id)
    and (select cluster_id from public.slots where id = slot_id) = cluster_id
  );

create policy "Super admins can view all cycles"
  on public.cycles for select
  using (public.is_admin() and public.is_super_admin());

drop policy "Admin full access to payments" on public.payments;

create policy "Coordinators manage their own payments"
  on public.payments for all
  using (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster((select cluster_id from public.cycles where id = cycle_id))
  )
  with check (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster((select cluster_id from public.cycles where id = cycle_id))
  );

create policy "Super admins can view all payments"
  on public.payments for select
  using (public.is_admin() and public.is_super_admin());
