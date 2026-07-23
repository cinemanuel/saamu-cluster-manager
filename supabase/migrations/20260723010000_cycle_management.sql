-- Cycle management (Slice 5): turns slot assignments into an actual,
-- trackable rotation. Uses the existing cycles table as-is — slot_id
-- (not collector_slot_id) and start_date/end_date (not cycle_date) are
-- the real column names from Entry 1; this slice just gives them
-- their first real use rather than renaming anything.
--
-- Also gives clusters.status its first real meaning: 'active' once
-- the first cycle starts, 'completed' once the rotation has no next
-- position left. That column has existed since Entry 1 but nothing
-- ever set it before now.

-- Guard rail: only one active cycle per cluster, enforced at the DB
-- level (not just app logic) via a partial unique index — the
-- app-level checks below are the primary defense, but a direct SQL
-- edit or a race can't create a second active cycle regardless.
create unique index cycles_one_active_per_cluster
  on public.cycles (cluster_id)
  where status = 'active';

create or replace function public.start_first_cycle(
  p_cluster_id uuid,
  p_start_date date default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_first_slot_id uuid;
begin
  if exists (select 1 from public.cycles where cluster_id = p_cluster_id) then
    raise exception 'A cycle already exists for this cluster.';
  end if;

  select id into v_first_slot_id
  from public.slots
  where cluster_id = p_cluster_id and position = 1;

  if v_first_slot_id is null then
    raise exception 'This cluster has no rotation position 1 yet.';
  end if;

  insert into public.cycles (cluster_id, slot_id, cycle_number, start_date, status)
  values (p_cluster_id, v_first_slot_id, 1, coalesce(p_start_date, current_date), 'active');

  update public.clusters set status = 'active' where id = p_cluster_id;
end;
$$;

-- Completes the given cycle and, if there's a next rotation position,
-- creates it as the new active cycle — in one atomic transaction, so
-- a failure partway (e.g. the one-active-cycle index rejecting a race)
-- rolls back the completion too, not just the creation. If there's no
-- next position, no new cycle is created and the cluster itself is
-- marked 'completed' instead of silently wrapping back to position 1.
create or replace function public.advance_cycle(
  p_cluster_id uuid,
  p_current_cycle_id uuid,
  p_next_start_date date default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_current_status text;
  v_current_position int;
  v_current_cycle_number int;
  v_next_slot_id uuid;
begin
  select c.status, s.position, c.cycle_number
  into v_current_status, v_current_position, v_current_cycle_number
  from public.cycles c
  join public.slots s on s.id = c.slot_id
  where c.id = p_current_cycle_id and c.cluster_id = p_cluster_id;

  if v_current_status is null then
    raise exception 'That cycle does not belong to this cluster.';
  end if;

  if v_current_status <> 'active' then
    raise exception 'This cycle is not active and cannot be advanced (status: %).', v_current_status;
  end if;

  update public.cycles
  set status = 'completed', end_date = coalesce(p_next_start_date, current_date)
  where id = p_current_cycle_id;

  select id into v_next_slot_id
  from public.slots
  where cluster_id = p_cluster_id and position > v_current_position
  order by position asc
  limit 1;

  if v_next_slot_id is null then
    update public.clusters set status = 'completed' where id = p_cluster_id;
    return;
  end if;

  insert into public.cycles (cluster_id, slot_id, cycle_number, start_date, status)
  values (
    p_cluster_id,
    v_next_slot_id,
    v_current_cycle_number + 1,
    coalesce(p_next_start_date, current_date),
    'active'
  );
end;
$$;
