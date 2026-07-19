-- Adds the coordinator fee amount to clusters, and backs the "must be a
-- positive number" validation rule with DB-level check constraints so it
-- holds regardless of which client writes to the table.

alter table public.clusters
  add column fee_amount numeric(12, 2) not null default 0;

alter table public.clusters
  alter column fee_amount drop default;

alter table public.clusters
  add constraint clusters_contribution_amount_positive check (contribution_amount > 0);

alter table public.clusters
  add constraint clusters_fee_amount_positive check (fee_amount > 0);
