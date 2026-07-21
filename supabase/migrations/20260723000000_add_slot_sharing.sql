-- Cycle management (Slice 5) needs shared slots: a rotation position
-- that can have multiple co-collectors, so a cycle for that slot can
-- show all of them rather than just one. Slice 4a's assignment model
-- only ever supported a single current holder per slot (reassignment
-- replaced whoever was there), so that needs generalizing here.

alter table public.slots
  add column is_shared boolean not null default false;

-- Generalizes reassign_slot_member(slot_id, member_id) to accept a set
-- of member ids instead of exactly one, so a shared slot can hold
-- multiple co-collectors. A single-element array reproduces the old
-- function's behavior exactly (delete existing holders, insert the
-- new one), so this fully replaces it rather than living alongside it.
--
-- Same atomicity rationale as before: DELETE and INSERT happen in one
-- plpgsql function call, i.e. one transaction, so a rejected insert
-- (e.g. the protected-head trigger firing on any of the new rows)
-- rolls back the delete too. The protected-head trigger already fires
-- once per inserted row regardless of how many rows one INSERT
-- statement adds, and a multi-row INSERT is itself atomic — so a
-- shared protected-head slot correctly requires every co-collector to
-- individually be Tier 3, not just one of them.

drop function if exists public.reassign_slot_member(uuid, uuid);

create or replace function public.set_slot_members(
  p_slot_id uuid,
  p_member_ids uuid[]
) returns void
language plpgsql
security invoker
as $$
begin
  delete from public.slot_members where slot_id = p_slot_id;

  insert into public.slot_members (slot_id, member_id)
  select p_slot_id, member_id from unnest(p_member_ids) as member_id;
end;
$$;
