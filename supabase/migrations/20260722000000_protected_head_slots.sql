-- "Protected head, fair tail" rotation rule: the first 2 collection
-- slots (position 1 and 2) in any cluster may only be assigned to a
-- Tier 3 member, since these positions carry the most fraud risk (paid
-- out before the member has built up contribution history). Fixed at
-- 2 head slots regardless of cluster size, hard-blocked (not a
-- warning) per product decision.
--
-- Enforced as a trigger on slot_members rather than app-level
-- validation alone, so it can't be bypassed by any client and can't
-- drift out of sync with the tier calculation — same rationale as the
-- kyc_tier trigger itself. The raised exception message is written to
-- be shown directly to the admin (surfaced via error.message in the
-- Server Action), so there's no separate app-level copy of this rule
-- to keep in sync.

create or replace function public.enforce_protected_head_slot()
returns trigger
language plpgsql
as $$
declare
  v_position int;
  v_kyc_tier smallint;
begin
  select position into v_position from public.slots where id = new.slot_id;
  select kyc_tier into v_kyc_tier from public.members where id = new.member_id;

  if v_position <= 2 and v_kyc_tier < 3 then
    raise exception 'Position % requires a Tier 3 member (this member is Tier %).', v_position, v_kyc_tier;
  end if;

  return new;
end;
$$;

create trigger slot_members_enforce_protected_head
  before insert or update on public.slot_members
  for each row execute function public.enforce_protected_head_slot();
