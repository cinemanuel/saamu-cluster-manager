-- KYC profiling, slice 1: capture the fields the tier calculation
-- (slice 3) will need beyond name/phone — residential address, and
-- business name/address. All nullable: a member can exist at Tier 1
-- with only name + phone, and these get filled in progressively.

alter table public.members
  add column residential_address text,
  add column business_name text,
  add column business_address text;
