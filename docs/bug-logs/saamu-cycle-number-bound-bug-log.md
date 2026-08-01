# Bug Log: `cycle_number` Has No Database-Level Bound

**Project:** Saamu Cluster Manager
**Found during:** CodeRabbit automated review of PR #16 (visual design pass), back/forward navigation commit
**Date:** August 1, 2026
**Severity:** Low (data-integrity gap — confirmed contained at the UI layer, not exploitable through the app's own interface)

## What happened

CodeRabbit flagged that `app/clusters/page.tsx` (and, on inspection, the equivalent code in `app/dashboard/page.tsx`) rendered `RotationRing` with `activePosition`/`completedCount` values taken directly from the `cycles` table, with no check that `cycle_number` (or the completed-cycle count) actually falls within the cluster's real slot count. Verified the claim by reading `supabase/migrations/20260724000000_multi_tenancy.sql`: the `"Coordinators manage their own cycles"` RLS policy's `with check` clause validates cluster ownership and that the slot belongs to the cluster, but does not constrain `cycle_number` at all.

## Why it happened

The app's own UI only ever writes cycles through two `security invoker` Postgres functions, `start_first_cycle` and `advance_cycle` (`supabase/migrations/20260723010000_cycle_management.sql`), both of which derive `cycle_number` from the actual slot sequence and can never produce an out-of-range value. Because every code path in the app goes through these functions, `cycle_number` bounds were never enforced at the database schema level itself — the RLS policy that governs direct table writes was written to protect ownership and slot/cluster consistency, not to re-derive the same "must be within the cluster's rotation length" invariant the stored procedures already guarantee by construction.

## Why it mattered

Not a security issue — the RLS policy still fully protects cross-cluster access; a coordinator can only write cycles for clusters they own. The gap is narrower: nothing stops a direct write (e.g. via the Supabase REST API or a raw SQL client, bypassing this app's UI and its two safe functions entirely) from inserting a `cycles` row with a `cycle_number` outside `1..totalPositions` for that cluster. Rendered through `RotationRing`, this would previously have looked wrong (an `activePosition` that never matches any drawn segment, or a `completedCount` inflating past the ring's total) rather than crashing, but it's still displaying data the UI implicitly assumed was valid.

## Fix applied

Defensive only, at the point of rendering — not at the source. `app/clusters/page.tsx` and `app/dashboard/page.tsx` now clamp both values before passing them to `RotationRing`: `activePosition` falls back to `null` if it isn't within `1..totalPositions`, and `completedCount` is capped at `totalPositions`. This prevents a bad row from producing a visibly broken ring, but a bad row can still be written, and would still display as a bounded-but-inaccurate result rather than the real (invalid) value — not a fix at the source. Discussed with CodeRabbit during PR #16's review; both the defensive scope and the deferred database fix were explicitly agreed on there.

## Recommended follow-up

Add a database-level `CHECK` constraint (or a `BEFORE INSERT/UPDATE` trigger, since the valid range depends on a join against `slots` rather than a static bound) enforcing that `cycle_number` actually falls within the cluster's real slot count, closing the gap at its source rather than relying on every future read site remembering to clamp defensively. This is a schema/migration change against a live table with an existing RLS policy, so — same reasoning as the super-admin write-attempt bug log above — it's a contained but real change that deserves its own reviewed migration rather than being folded into an unrelated feature commit.
