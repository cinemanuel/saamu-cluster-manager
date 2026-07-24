-- Configurable coordinator payout fee (Entry 8, slice a): replaces the
-- flat, always-positive clusters.fee_amount (Entry 3) with a fee_type
-- (fixed / percentage / none) + fee_value pair, and turns advance_cycle
-- into a formal payout event that records exactly what a coordinator
-- earned and what the collecting member received — nothing before this
-- has ever recorded that money changed hands; advance_cycle only ever
-- moved cycle/cluster status around.
--
-- As with Entry 7's slices, this migration and slice 8b's app-code
-- changes are meant to ship together — dropping fee_amount here would
-- break the still-unupdated create/edit cluster forms and clusters
-- list if applied to production on its own.

-- ---------------------------------------------------------------------
-- clusters.fee_type / fee_value — replaces fee_amount. Backfilled to
-- 'fixed' + the existing fee_amount for every current cluster, since
-- fee_amount's own check constraint already guarantees every row has
-- a valid positive flat fee today — there's no ambiguous case to
-- resolve.
-- ---------------------------------------------------------------------

alter table public.clusters
  add column fee_type text,
  add column fee_value numeric(12, 2);

update public.clusters
set fee_type = 'fixed', fee_value = fee_amount
where fee_type is null;

alter table public.clusters
  alter column fee_type set not null,
  alter column fee_type set default 'fixed',
  add constraint clusters_fee_type_check check (fee_type in ('fixed', 'percentage', 'none')),
  add constraint clusters_fee_value_valid check (
    (fee_type = 'none' and fee_value is null)
    or (fee_type = 'fixed' and fee_value > 0)
    or (fee_type = 'percentage' and fee_value > 0 and fee_value <= 100)
  );

alter table public.clusters
  drop constraint clusters_fee_amount_positive,
  drop column fee_amount;

-- ---------------------------------------------------------------------
-- calculate_coordinator_fee — the one place the fee formula lives, so
-- the "projected" figure shown for a still-active cycle (slice 8b) and
-- the amount actually recorded when a cycle completes can never
-- disagree. Percentage rounds to the nearest whole naira; fixed and
-- none are exact by definition.
-- ---------------------------------------------------------------------

create or replace function public.calculate_coordinator_fee(
  p_fee_type text,
  p_fee_value numeric,
  p_total_pot numeric
) returns numeric
language sql
immutable
as $$
  select case p_fee_type
    when 'fixed' then p_fee_value
    when 'percentage' then round(p_total_pot * p_fee_value / 100)
    else 0
  end;
$$;

-- ---------------------------------------------------------------------
-- payouts — one row per completed cycle, snapshotting fee_type/
-- fee_value/fee_amount at the moment of completion so a later fee
-- change never rewrites history. total_pot is always
-- contribution_amount x member_count (the full expected pot), not
-- just what was actually collected — same convention as Entry 7's
-- "pool", confirmed correct for that same reason there.
-- ---------------------------------------------------------------------

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  total_pot numeric(12, 2) not null,
  fee_type text not null check (fee_type in ('fixed', 'percentage', 'none')),
  fee_value numeric(12, 2),
  fee_amount numeric(12, 2) not null,
  net_payout numeric(12, 2) not null,
  payout_date date not null,
  created_at timestamptz not null default now(),
  unique (cycle_id)
);

create index payouts_cycle_id_idx on public.payouts (cycle_id);

alter table public.payouts enable row level security;

-- Insert + select only, deliberately no update/delete policy at all —
-- this is a financial audit trail, so even the coordinator whose data
-- it is shouldn't be able to edit or remove a recorded payout.
create policy "Coordinators view their own payouts"
  on public.payouts for select
  using (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster((select cluster_id from public.cycles where id = cycle_id))
  );

create policy "Coordinators record their own payouts"
  on public.payouts for insert
  with check (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster((select cluster_id from public.cycles where id = cycle_id))
  );

create policy "Super admins can view all payouts"
  on public.payouts for select
  using (public.is_admin() and public.is_super_admin());

-- ---------------------------------------------------------------------
-- payout_transactions — the two auditable ledger entries per payout
-- (member_payout + coordinator_fee), per the product requirement that
-- every fee deduction be recorded in transaction history.
-- ---------------------------------------------------------------------

create table public.payout_transactions (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts (id) on delete cascade,
  type text not null check (type in ('member_payout', 'coordinator_fee')),
  member_id uuid references public.members (id) on delete cascade,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  check (
    (type = 'member_payout' and member_id is not null)
    or (type = 'coordinator_fee' and member_id is null)
  )
);

create index payout_transactions_payout_id_idx on public.payout_transactions (payout_id);

alter table public.payout_transactions enable row level security;

create policy "Coordinators view their own payout transactions"
  on public.payout_transactions for select
  using (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster((
      select cy.cluster_id
      from public.payouts p
      join public.cycles cy on cy.id = p.cycle_id
      where p.id = payout_id
    ))
  );

create policy "Coordinators record their own payout transactions"
  on public.payout_transactions for insert
  with check (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster((
      select cy.cluster_id
      from public.payouts p
      join public.cycles cy on cy.id = p.cycle_id
      where p.id = payout_id
    ))
    and (
      member_id is null
      or (select cluster_id from public.members where id = member_id) = (
        select cy.cluster_id
        from public.payouts p
        join public.cycles cy on cy.id = p.cycle_id
        where p.id = payout_id
      )
    )
  );

create policy "Super admins can view all payout transactions"
  on public.payout_transactions for select
  using (public.is_admin() and public.is_super_admin());

-- ---------------------------------------------------------------------
-- Table-level grants: Postgres checks these before RLS ever runs (the
-- exact gap fixed in Entry 3 for the original six domain tables), and
-- these two are brand new. Only select/insert are granted — never
-- update/delete — so "no edits to the audit trail" is enforced at two
-- independent layers, not just by omitting RLS policies for them.
-- ---------------------------------------------------------------------

grant select, insert on public.payouts, public.payout_transactions to authenticated;

-- ---------------------------------------------------------------------
-- advance_cycle — extended to record a payout when the completing
-- cycle's slot has exactly one collector. Zero or multiple collectors
-- (a shared slot) is a documented, deliberate limitation: the cycle
-- still advances normally, but no payout is recorded, and a warning
-- describing why is returned to the caller instead of raising an
-- exception — a coordinator shouldn't be stuck unable to progress the
-- rotation just because payout bookkeeping can't be computed for one
-- position. Return type changes from void to text (null on a normal
-- recorded payout, a warning message otherwise); existing callers that
-- only check the RPC's error and ignore its data keep working
-- unchanged.
-- ---------------------------------------------------------------------

drop function public.advance_cycle(uuid, uuid, date);

create function public.advance_cycle(
  p_cluster_id uuid,
  p_current_cycle_id uuid,
  p_next_start_date date default null
) returns text
language plpgsql
security invoker
as $$
declare
  v_current_status text;
  v_current_position int;
  v_current_cycle_number int;
  v_current_start_date date;
  v_current_slot_id uuid;
  v_next_slot_id uuid;
  v_completion_date date;
  v_collector_count int;
  v_collector_member_id uuid;
  v_contribution_amount numeric(12, 2);
  v_member_count int;
  v_total_pot numeric(12, 2);
  v_fee_type text;
  v_fee_value numeric(12, 2);
  v_fee_amount numeric(12, 2);
  v_net_payout numeric(12, 2);
  v_payout_id uuid;
  v_warning text;
begin
  select c.status, s.position, c.cycle_number, c.start_date, c.slot_id
  into v_current_status, v_current_position, v_current_cycle_number, v_current_start_date, v_current_slot_id
  from public.cycles c
  join public.slots s on s.id = c.slot_id
  where c.id = p_current_cycle_id and c.cluster_id = p_cluster_id;

  if v_current_status is null then
    raise exception 'That cycle does not belong to this cluster.';
  end if;

  if v_current_status <> 'active' then
    raise exception 'This cycle is not active and cannot be advanced (status: %).', v_current_status;
  end if;

  if p_next_start_date is not null and p_next_start_date < v_current_start_date then
    raise exception
      'The next start date (%) cannot be earlier than the current cycle''s start date (%).',
      p_next_start_date, v_current_start_date;
  end if;

  v_completion_date := coalesce(p_next_start_date, greatest(current_date, v_current_start_date));

  select id into v_next_slot_id
  from public.slots
  where cluster_id = p_cluster_id and position > v_current_position
  order by position asc
  limit 1;

  update public.cycles
  set status = 'completed', end_date = v_completion_date
  where id = p_current_cycle_id;

  select count(*) into v_collector_count
  from public.slot_members
  where slot_id = v_current_slot_id;

  if v_collector_count = 1 then
    select cl.contribution_amount, cl.fee_type, cl.fee_value
    into v_contribution_amount, v_fee_type, v_fee_value
    from public.clusters cl
    where cl.id = p_cluster_id;

    select count(*) into v_member_count from public.members where cluster_id = p_cluster_id;

    v_total_pot := v_contribution_amount * v_member_count;
    v_fee_amount := public.calculate_coordinator_fee(v_fee_type, v_fee_value, v_total_pot);
    v_net_payout := v_total_pot - v_fee_amount;

    select member_id into v_collector_member_id
    from public.slot_members
    where slot_id = v_current_slot_id;

    insert into public.payouts (cycle_id, total_pot, fee_type, fee_value, fee_amount, net_payout, payout_date)
    values (p_current_cycle_id, v_total_pot, v_fee_type, v_fee_value, v_fee_amount, v_net_payout, v_completion_date)
    returning id into v_payout_id;

    insert into public.payout_transactions (payout_id, type, member_id, amount)
    values
      (v_payout_id, 'member_payout', v_collector_member_id, v_net_payout),
      (v_payout_id, 'coordinator_fee', null, v_fee_amount);
  elsif v_collector_count = 0 then
    v_warning := 'Payout not recorded: this position has no collector assigned.';
  else
    v_warning := format(
      'Payout not recorded: this position has %s collectors (shared-slot payouts are not supported yet).',
      v_collector_count
    );
  end if;

  if v_next_slot_id is null then
    update public.clusters set status = 'completed' where id = p_cluster_id;
    return v_warning;
  end if;

  insert into public.cycles (cluster_id, slot_id, cycle_number, start_date, status)
  values (p_cluster_id, v_next_slot_id, v_current_cycle_number + 1, v_completion_date, 'active');

  return v_warning;
end;
$$;
