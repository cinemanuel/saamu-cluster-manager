-- Fixes a real bug found in live testing: completing the final cycle
-- of a rotation (no next position) with the date field left blank
-- wrote end_date = current_date (today's real date) with no regard
-- for the cycle's own start_date. If that cycle's start_date was
-- ever set later than today (e.g. a future-dated cycle from earlier
-- testing, or simply a rotation whose cadence isn't "today"), the
-- result is an impossible end_date < start_date row.
--
-- Root cause: p_next_start_date genuinely doesn't apply when there is
-- no next cycle (there's nothing "next" to date), yet the old
-- function used the same `coalesce(p_next_start_date, current_date)`
-- expression for the completed cycle's end_date regardless of
-- whether a next cycle exists.
--
-- Fixed by computing one completion date used for BOTH the completed
-- cycle's end_date and (when applicable) the new cycle's start_date,
-- so the two always agree with each other, not just individually
-- valid against their own row. When no explicit next-start-date is
-- given, it defaults to today floored to the current cycle's own
-- start_date (never earlier). When one IS explicitly given, it's
-- validated and rejected with a clear error if it would still be
-- earlier than the current cycle's start_date, rather than silently
-- overriding an explicit admin choice.

-- Correct any existing rows already written by the buggy version
-- before adding the constraint below, so the constraint doesn't fail
-- on data the old code already wrote.
update public.cycles
set end_date = start_date
where end_date is not null and end_date < start_date;

alter table public.cycles
  add constraint cycles_end_date_not_before_start_date
  check (end_date is null or end_date >= start_date);

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
  v_current_start_date date;
  v_next_slot_id uuid;
  v_completion_date date;
begin
  select c.status, s.position, c.cycle_number, c.start_date
  into v_current_status, v_current_position, v_current_cycle_number, v_current_start_date
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

  -- One completion date, used for both the old cycle's end_date and
  -- the new cycle's start_date, so they always agree with each
  -- other. Only defaults (never overrides an explicit valid date)
  -- floor to the current cycle's own start_date.
  v_completion_date := coalesce(p_next_start_date, greatest(current_date, v_current_start_date));

  select id into v_next_slot_id
  from public.slots
  where cluster_id = p_cluster_id and position > v_current_position
  order by position asc
  limit 1;

  update public.cycles
  set status = 'completed', end_date = v_completion_date
  where id = p_current_cycle_id;

  if v_next_slot_id is null then
    update public.clusters set status = 'completed' where id = p_cluster_id;
    return;
  end if;

  insert into public.cycles (cluster_id, slot_id, cycle_number, start_date, status)
  values (p_cluster_id, v_next_slot_id, v_current_cycle_number + 1, v_completion_date, 'active');
end;
$$;
