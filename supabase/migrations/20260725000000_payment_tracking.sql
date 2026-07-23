-- Payment/contribution tracking (Entry 7, slice a): every member pays
-- their own contribution_amount every cycle, no one excluded (not even
-- that cycle's collector) — the payout pool is always
-- contribution_amount x member_count, with fee_amount deducted once
-- from the pool total, not charged per member.
--
-- "Late" is a display-only state computed by the app at page-load time
-- (pending + due_date < today), never written to the payments.status
-- column itself — no scheduled job needed to flip it.

-- ---------------------------------------------------------------------
-- payments.due_date — new column. Set to the owning cycle's start_date,
-- since a member's contribution for a cycle is due when that cycle
-- opens. Nullable first, backfilled, then locked to NOT NULL — same
-- pattern as the clusters.owner_id backfill in Entry 6, though this
-- table is expected to be empty today (no app code has ever written to
-- it).
-- ---------------------------------------------------------------------

alter table public.payments
  add column due_date date;

update public.payments p
set due_date = c.start_date
from public.cycles c
where p.cycle_id = c.id and p.due_date is null;

alter table public.payments
  alter column due_date set not null;

-- ---------------------------------------------------------------------
-- payments.payment_method — restrict to the three methods a
-- coordinator can actually record; nullable until a payment is marked
-- paid.
-- ---------------------------------------------------------------------

alter table public.payments
  add constraint payments_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'bank_transfer', 'mobile_money'));

-- ---------------------------------------------------------------------
-- RLS fix: the "Coordinators manage their own payments" policy (Entry 6)
-- verified the coordinator owned the referenced cycle's cluster, but
-- never checked that the linked member actually belonged to that same
-- cluster — the same relationship-check gap already fixed on
-- slot_members and cycles in Entry 6, closed here for payments too.
-- ---------------------------------------------------------------------

drop policy "Coordinators manage their own payments" on public.payments;

create policy "Coordinators manage their own payments"
  on public.payments for all
  using (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster((select cluster_id from public.cycles where id = cycle_id))
    and (select cluster_id from public.members where id = member_id)
        = (select cluster_id from public.cycles where id = cycle_id)
  )
  with check (
    public.is_admin() and not public.is_super_admin()
    and public.owns_cluster((select cluster_id from public.cycles where id = cycle_id))
    and (select cluster_id from public.members where id = member_id)
        = (select cluster_id from public.cycles where id = cycle_id)
  );

-- ---------------------------------------------------------------------
-- Auto-create one pending payment row per cluster member whenever a
-- new cycle is created — everyone pays every cycle, so no membership
-- filtering beyond "belongs to this cluster" is needed. Triggered off
-- cycles rather than folded into start_first_cycle/advance_cycle so the
-- payment-row behavior lives in one place regardless of which function
-- (or a future one) creates a cycle.
-- ---------------------------------------------------------------------

create or replace function public.create_cycle_payments()
returns trigger
language plpgsql
as $$
begin
  insert into public.payments (cycle_id, member_id, amount, status, due_date)
  select new.id, m.id, c.contribution_amount, 'pending', new.start_date
  from public.members m
  join public.clusters c on c.id = m.cluster_id
  where m.cluster_id = new.cluster_id;

  return new;
end;
$$;

create trigger cycles_create_payments
  after insert on public.cycles
  for each row execute function public.create_cycle_payments();
