-- Database foundation for Saamu Cluster Manager.
-- Tables: clusters, members, slots, slot_members, cycles, payments.
-- Every table is admin-only: this is a single-coordinator tool, so the
-- only auth accounts that exist belong to admins, and RLS enforces that
-- explicitly via the admin_users allow-list rather than assuming it.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Admin allow-list and helper used by every RLS policy below.
-- ---------------------------------------------------------------------

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

create policy "Admins can view the admin list"
  on public.admin_users for select
  using (public.is_admin());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- clusters
-- ---------------------------------------------------------------------

create table public.clusters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  contribution_amount numeric(12, 2) not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  start_date date,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clusters enable row level security;

create trigger clusters_set_updated_at
  before update on public.clusters
  for each row execute function public.set_updated_at();

create policy "Admin full access to clusters"
  on public.clusters for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------

create table public.members (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.clusters (id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  photo_path text,
  kyc_status text not null default 'pending' check (kyc_status in ('pending', 'verified', 'rejected')),
  joined_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index members_cluster_id_idx on public.members (cluster_id);

alter table public.members enable row level security;

create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

create policy "Admin full access to members"
  on public.members for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- slots
-- Rotation positions within a cluster (the fixed payout order).
-- ---------------------------------------------------------------------

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.clusters (id) on delete cascade,
  position int not null,
  label text,
  created_at timestamptz not null default now(),
  unique (cluster_id, position)
);

create index slots_cluster_id_idx on public.slots (cluster_id);

alter table public.slots enable row level security;

create policy "Admin full access to slots"
  on public.slots for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- slot_members
-- Assigns members to rotation slots (kept separate from slots so a
-- slot's holder can be reassigned without losing history).
-- ---------------------------------------------------------------------

create table public.slot_members (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (slot_id, member_id)
);

create index slot_members_slot_id_idx on public.slot_members (slot_id);
create index slot_members_member_id_idx on public.slot_members (member_id);

alter table public.slot_members enable row level security;

create policy "Admin full access to slot_members"
  on public.slot_members for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- cycles
-- One rotation period for a cluster; slot_id is whose turn it is to
-- receive the payout that cycle.
-- ---------------------------------------------------------------------

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.clusters (id) on delete cascade,
  slot_id uuid not null references public.slots (id) on delete restrict,
  cycle_number int not null,
  start_date date not null,
  end_date date,
  status text not null default 'pending' check (status in ('pending', 'active', 'completed')),
  created_at timestamptz not null default now(),
  unique (cluster_id, cycle_number)
);

create index cycles_cluster_id_idx on public.cycles (cluster_id);
create index cycles_slot_id_idx on public.cycles (slot_id);

alter table public.cycles enable row level security;

create policy "Admin full access to cycles"
  on public.cycles for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- payments
-- Each member's contribution for a given cycle.
-- ---------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  amount numeric(12, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'late', 'waived')),
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  unique (cycle_id, member_id)
);

create index payments_cycle_id_idx on public.payments (cycle_id);
create index payments_member_id_idx on public.payments (member_id);

alter table public.payments enable row level security;

create policy "Admin full access to payments"
  on public.payments for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Storage: member photos
-- Private bucket; only admins may read/write.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('member-photos', 'member-photos', false)
on conflict (id) do nothing;

create policy "Admin full access to member photos"
  on storage.objects for all
  using (bucket_id = 'member-photos' and public.is_admin())
  with check (bucket_id = 'member-photos' and public.is_admin());
