-- KYC profiling, slice 3: auto-calculate a member's KYC tier from
-- which fields are filled in, per the PRD's mapping:
--   Tier 1 = floor (every member starts here — see note below)
--   Tier 2 = Tier 1 + photo + residential address
--   Tier 3 = Tier 2 + business name + business address
--
-- Product decision: Tier 1 is an unconditional floor. The PRD frames
-- Tier 1 as "name + WhatsApp", but phone is enforced as a required
-- form field going forward (app-level only, not backfilled as a DB
-- constraint — existing rows may predate that rule) rather than as a
-- tier-gating condition, so kyc_tier is always 1, 2, or 3, never 0.
--
-- Computed via a trigger rather than in application code so the tier
-- can never drift out of sync with the underlying fields, regardless
-- of which client writes to the row (matches how invariants have been
-- enforced elsewhere in this schema, e.g. the positivity checks on
-- clusters).

create or replace function public.calculate_member_kyc_tier(
  p_photo_path text,
  p_residential_address text,
  p_business_name text,
  p_business_address text
) returns smallint
language sql
immutable
as $$
  select case
    when p_photo_path is not null
      and p_residential_address is not null
      and p_business_name is not null
      and p_business_address is not null
      then 3
    when p_photo_path is not null
      and p_residential_address is not null
      then 2
    else 1
  end;
$$;

alter table public.members
  add column kyc_tier smallint not null default 1 check (kyc_tier in (1, 2, 3));

create or replace function public.set_member_kyc_tier()
returns trigger
language plpgsql
as $$
begin
  new.kyc_tier := public.calculate_member_kyc_tier(
    new.photo_path, new.residential_address, new.business_name, new.business_address
  );
  return new;
end;
$$;

create trigger members_set_kyc_tier
  before insert or update on public.members
  for each row execute function public.set_member_kyc_tier();

-- Backfill existing rows so tier reflects their current fields
-- immediately, rather than waiting for their next edit.
update public.members
set kyc_tier = public.calculate_member_kyc_tier(
  photo_path, residential_address, business_name, business_address
);
