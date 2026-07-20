-- Fixes a real data-loss bug found in live testing: assignMember
-- previously did a DELETE followed by a separate INSERT as two
-- independent PostgREST requests. Those are not one transaction — if
-- the protected-head trigger rejected the INSERT, the DELETE had
-- already committed, silently clearing a valid Tier 3 assignment on a
-- rejected reassignment attempt.
--
-- Wrapping both statements in a single plpgsql function makes them
-- one atomic transaction: if the INSERT raises (via the protected-head
-- trigger), the whole function call rolls back, including the DELETE.
--
-- security invoker (the default) so RLS/is_admin() still evaluates
-- against the calling user, exactly as when the two statements were
-- issued directly.

create or replace function public.reassign_slot_member(
  p_slot_id uuid,
  p_member_id uuid
) returns void
language plpgsql
security invoker
as $$
begin
  delete from public.slot_members where slot_id = p_slot_id;
  insert into public.slot_members (slot_id, member_id) values (p_slot_id, p_member_id);
end;
$$;
