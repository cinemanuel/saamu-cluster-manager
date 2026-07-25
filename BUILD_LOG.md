# Build Log — Saamu Cluster Manager

A running record of what was built, when, and how — using AI-assisted ("vibe coding") development.

---

## Entry 1 — Database Foundation
**Date:** July 18, 2026
**What was built:** Supabase database schema applied to the live production project — 7 tables (clusters, members, slots, slot_members, cycles, payments, admin_users). Row Level Security enabled on all tables, gated by a public.is_admin() function checking the admin_users allow-list. Private storage bucket configured for member photos with the same admin-only policy.
**How it was verified:** Schema tested against a real Postgres instance before deployment (confirmed RLS blocks non-admin access, confirmed invalid data is rejected). Applied to the live Supabase project via SQL Editor. Confirmed all 7 tables exist in Table Editor. Coordinator account created in Supabase Auth and added to admin_users.
**Status:** ✅ Complete and verified live

---

## Entry 2 — Admin Login Flow
**What was built:** Email/password login page, sign-out handler, and middleware/proxy route protection redirecting unauthenticated users to /login and authenticated users away from it.
**Debugging note:** Initial deployment showed a persistent 404 on all routes despite a successful build. Root cause: the Vercel project's Framework Preset was locked to "Other" from an early deployment made before real Next.js code existed in the repo — Project Settings had since correctly auto-detected Next.js, but existing deployments retained their original stale settings. Fixed by pushing a new commit to trigger a fresh deployment rather than redeploying an old one.
**How it was verified:** Signed in live with the real coordinator account against the deployed app — confirmed working end-to-end, not just locally simulated.
**Status:** ✅ Complete and verified live

---

## Entry 3 (Slice 1) — Cluster Management
**What was built:** Migration adding a `fee_amount` column to `clusters`, plus DB-level check constraints requiring `contribution_amount` and `fee_amount` to be positive. A `/clusters` list page, a `/clusters/new` create form, and a `/clusters/[id]/edit` edit form — all using Server Actions with the same validation rule (name required; contribution and fee amounts must be positive numbers) enforced both client-side (HTML `required`/`min`) and server-side before the Supabase write. All three routes sit behind the existing proxy auth guard, so unauthenticated requests bounce to `/login` same as every other page.

**Debugging note 1 — "permission denied for table clusters":** First live attempt to create a cluster failed, even though the signed-in account was correctly listed in `admin_users`. Root cause: the initial schema migration enabled RLS and added admin-only policies on every domain table, but never `GRANT`ed the `authenticated` role base `SELECT`/`INSERT`/`UPDATE`/`DELETE` privileges on those tables. Postgres checks table-level grants *before* it ever evaluates a row's RLS policy, so the request was rejected at that earlier gate — `is_admin()` never got a chance to run. Reproduced the exact error locally (a role with RLS-admin status but no table grant hits the same "permission denied" message), confirmed the `GRANT` fixes it, and confirmed a non-admin authenticated role stays correctly blocked by RLS afterward — the grant doesn't loosen anything beyond closing the gap. Fixed via a follow-up migration (`20260719020000_grant_authenticated_table_access.sql`) granting `authenticated` access on all six domain tables.

**Debugging note 2 — sign-out 405:** Clicking "Sign out" returned an HTTP 405 on `/login` instead of signing out. Root cause: both the sign-out route handler and the proxy's own auth-redirect used `NextResponse.redirect()` without an explicit status, defaulting to `307 Temporary Redirect`. A 307 preserves the original request method, so the POST to `/auth/signout` redirected into a **POST** against `/login` — a GET-only page — producing the 405. Fixed by redirecting with an explicit `303 See Other` in both places, which always forces the follow-up request to GET. Verified with `curl -X POST -L` against `/auth/signout`, which now resolves to a `200` on `/login` instead of a `405`.

**Debugging note 3 — no way back from /clusters:** There was no navigation off the cluster pages once you left the home page — no link back home, no sign-out button. Added a shared nav bar (Home / Clusters / Sign out) to the home page and all three cluster pages.

**How it was verified:** Local test-Postgres migration checks for both the `fee_amount` constraints and the `authenticated` grant (including reproducing and then resolving the exact "permission denied" error). `npm run build`/`lint`/`tsc --noEmit` all clean throughout. Locally confirmed all cluster routes redirect unauthenticated requests to `/login`, and that the sign-out redirect resolves to 200 instead of 405. Live on the deployed app: signed in as the real coordinator account and confirmed cluster creation (including validation rejecting a non-positive amount), sign-out, and the new navigation all work end-to-end.
**Status:** ✅ Complete and verified live

---

## Entry 3 (Slice 2) — Member Management
**What was built:** Member management scoped to a cluster, using the existing `members` table (no schema changes needed). `/clusters/[id]/members` — list of a cluster's members; `/clusters/[id]/members/new` — add-member form; `/clusters/[id]/members/[memberId]/edit` — edit form. Fields: full name (required), phone, email — photo upload and KYC status editing deferred to a later slice, per scope confirmed before starting. Same Server Action + `useActionState` pattern as cluster management, with validation (name required) enforced server-side. Added "Members" links from the clusters list, and all new routes carry the shared `SiteNav`.
**How it was verified:** `npm run build`/`lint`/`tsc --noEmit` all clean. Local dev server: unauthenticated requests to `/clusters/[id]/members`, `.../new`, and `.../[memberId]/edit` all correctly redirect (303) to `/login`. Live on the deployed app: signed in as the real coordinator account and confirmed member creation, editing, validation (name required), and navigation all work end-to-end — passed clean verification with no bugs found.
**Status:** ✅ Complete and verified live

---

## Entry 4 (Slice 1) — KYC Profiling: Address Fields
**What was built:** First slice of KYC profiling, per the PRD's tier mapping (Tier 1 = name + WhatsApp; Tier 2 = + photo + residential address; Tier 3 = + business name + business address). This slice adds the address/business fields the tier calculation (slice 3) will need: a migration adding `residential_address`, `business_name`, `business_address` (all nullable) to `members`, and extends the existing add/edit member form with those three fields. Photo upload (slice 2), tier auto-calculation (slice 3), minimal slot assignment (slice 4a), and protected-head enforcement (slice 4b) are separate, not-yet-started slices.
**How it was verified:** Migration re-run against local Postgres alongside all prior migrations in sequence (confirms no conflicts with existing schema); inserted a partial-fields member and a full-fields member locally to confirm the new columns are genuinely optional and round-trip correctly. `npm run build`/`lint`/`tsc --noEmit` all clean. Local dev server: unauthenticated requests to the member add/edit routes still correctly redirect (303) to `/login`. Live on the deployed app: residential address, business name, and business address all confirmed to persist correctly through a real page reload, and creating a member with all three fields blank (the Tier 1 case) also works cleanly — no bugs found.
**Status:** ✅ Complete and verified live — slices 2, 3, 4a, 4b not started

---

## Entry 4 (Slice 2) — KYC Profiling: Photo Upload
**What was built:** Wires up the `member-photos` storage bucket (created back in Entry 1, unused until now) for member photo upload. The member add/edit form gets a file input; on save, the photo uploads to the bucket keyed by the member's id (`upsert: true`, so editing and re-uploading just overwrites the same object — no orphaned files to clean up) and `members.photo_path` is set to that key. The members list shows a thumbnail per member (or a placeholder square if no photo) via a batched `createSignedUrls` call; the edit page shows the current photo via a single `createSignedUrl` call — both needed because the bucket is private, so a plain public URL won't render.
**Migration:** None. `members.photo_path` and the `member-photos` bucket (with its admin-only RLS policy) already existed from Entry 1. Checked whether `storage.objects` might need the same missing-`GRANT` treatment that hit `clusters` in Entry 3 — it doesn't apply here, since `storage.objects` is part of Supabase's own bootstrapped schema (we never had to enable RLS on it ourselves, unlike our own tables), so it should already carry Supabase's default grants.

**Debugging note — 413 "Body exceeded 1 MB limit":** First live upload attempt failed. Root cause: the initial implementation routed the raw photo file through the member Server Action (uploading to Storage server-side, after receiving the file via `formData`), and Next.js Server Actions cap request bodies at 1MB by default — a real phone photo blows past that easily. Raising the limit in `next.config.js` would only have been a partial fix: Vercel's own serverless functions cap request bodies at roughly 4.5MB regardless of what Next.js is configured to allow, so a typical 5–15MB phone photo would still fail. Fixed properly by moving the upload to the browser: the photo now uploads directly from the client to Supabase Storage (using the same browser Supabase client already used for login), and only the resulting storage key (`photo_path`, plus a client-generated `id` for new members) crosses the Server Action boundary — never the file bytes. This also meant moving id-generation for new members from the server action to the browser (`crypto.randomUUID()`), since the storage key needs to exist before the client can upload to it, ahead of the row being inserted.
**How it was verified:** `npm run build`/`lint`/`tsc --noEmit` all clean locally. Live on the deployed app (verified on the PR preview before merging): uploaded a real, unedited multi-MB phone photo — succeeded with no 413, thumbnail displayed correctly. Also confirmed replacing that photo with a different one updates the thumbnail cleanly (no orphaned image), and that members with no photo still show the placeholder correctly.
**Status:** ✅ Complete and verified live — slices 3, 4a, 4b not started

---

## Entry 4 (Slice 3) — KYC Profiling: Tier Auto-Calculation
**What was built:** A `kyc_tier` column on `members` (1/2/3, `check` constrained, default 1), computed by a `BEFORE INSERT OR UPDATE` trigger from which fields are filled in — Tier 3 needs photo + residential address + business name + business address; Tier 2 needs photo + residential address; otherwise Tier 1. **Product decision on an edge case surfaced during scoping:** the PRD frames Tier 1 as "name + WhatsApp," but since `phone` was previously optional, a member could exist without one — confirmed with the user that Tier 1 is an unconditional floor (never 0), and phone is instead now a **required field on the member form** going forward (both the HTML `required` attribute and server-side validation), so new data satisfies the PRD's Tier 1 definition without a hard DB constraint that could break pre-existing rows. Tier is displayed on the members list and as a read-only line on the edit form ("calculated automatically from the fields below").
**Migration:** `20260721000000_add_member_kyc_tier.sql` — adds `calculate_member_kyc_tier()` (pure function), the `kyc_tier` column, the `set_member_kyc_tier()` trigger function + trigger, and a one-time backfill `UPDATE` so existing rows get a correct tier immediately rather than waiting for their next edit. Following the same pattern as `set_updated_at`/the positivity checks: computed by a trigger rather than in application code, so the tier can never drift out of sync with the underlying fields regardless of which client writes to the row.
**How it was verified:** Migration re-run against local Postgres alongside the full existing sequence — no conflicts. Directly tested the trigger logic with inserts/updates covering all four tier outcomes (1, 2, 3, and "3 minus one business field falls back to 2"), an upgrade case (editing a Tier 1 member to add photo+address bumps it to 2), and a downgrade case (removing a business field from a Tier 3 member drops it back to 2) — all computed correctly. Confirmed the check constraint can't actually be violated in practice, since the trigger recomputes and overwrites `kyc_tier` on every write before the constraint is checked. `npm run build`/`lint`/`tsc --noEmit` all clean locally. Live on the deployed app: all 7 test steps confirmed, including the downgrade case (Tier 3 → Tier 2 correctly, not stuck) and editing a legacy no-phone member (now correctly blocked from saving until a phone is added).
**Status:** ✅ Complete and verified live — slices 4a, 4b not started

---

## Entry 4 (Slice 4a) — Minimal Slot Assignment
**What was built:** First rotation-management screen, using the existing `slots`/`slot_members` tables (no schema changes needed — the "kept separate from slots so a slot's holder can be reassigned without losing history" comment on `slot_members` predates this slice but wasn't acted on until now). A `/clusters/[id]/slots` page lists a cluster's rotation positions in order, with a form to add a new position (position number, required and must be a positive whole number; optional label) and, per row, a dropdown to assign one of the cluster's members to that position. **Design decision:** rather than treat `slot_members` as an append-only history log, this slice treats each slot as having at most one *current* holder — reassigning replaces the previous assignment (delete then insert) rather than accumulating rows. Full reassignment history isn't needed yet, and can be layered on later without a breaking schema change if it turns out to matter. Also added a "Rotation" link from the clusters list, alongside "Members" and "Edit."
**How it was verified:** `npm run build`/`lint`/`tsc --noEmit` all clean locally. Live on the deployed app: all 6 test steps confirmed — empty state, adding positions, duplicate-position detection, assignment persisting after reload, reassignment correctly replacing (not duplicating) on two separate positions tested independently, and the no-members-yet case.
**Status:** ✅ Complete and verified live — slice 4b (protected-head enforcement) not started

---

## Entry 4 (Slice 4b) — Protected-Head Enforcement
**What was built:** The "protected head, fair tail" rotation rule: positions 1 and 2 in any cluster (fixed at 2 regardless of cluster size, per product decision) may only be assigned to a Tier 3 member, hard-blocked rather than a warning. Enforced entirely as a `BEFORE INSERT OR UPDATE` trigger on `slot_members` — same rationale as the `kyc_tier` trigger: it can't be bypassed by any client and can't drift out of sync with the tier calculation. The trigger's `RAISE EXCEPTION` message is written to be shown directly to the admin ("Position 1 requires a Tier 3 member (this member is Tier 1)."), surfaced as-is via the Server Action's existing `error.message` handling — no separate app-level copy of this rule to keep in sync. Also added a small safety check in `assignMember` verifying the slot actually belongs to the cluster (mirrors the existing member-cluster check), and a "Requires Tier 3" badge on positions 1–2 in the slots list so the admin sees the constraint before hitting the block, not just after.
**Migration:** `20260722000000_protected_head_slots.sql` — adds `enforce_protected_head_slot()` and its trigger.

**Debugging note — rejected reassignment silently clears the slot:** Live testing found that attempting to reassign an already-Tier-3-assigned protected slot (position 1 or 2) to a non-Tier-3 member correctly showed the validation error, but on refresh the position had reverted to Unassigned instead of keeping the original Tier 3 member. Root cause: `assignMember` performed the reassignment as a `DELETE` followed by a separate `INSERT`, each its own independent PostgREST request — not one transaction. When the protected-head trigger rejected the `INSERT`, the `DELETE` had already committed, silently destroying a valid assignment on a rejected attempt. Fixed by moving both statements into a single `plpgsql` function (`reassign_slot_member`, migration `20260722010000_atomic_slot_reassignment.sql`, `security invoker` so RLS still evaluates against the calling admin) called via `supabase.rpc(...)` — a single RPC call is one atomic transaction, so a trigger rejection now rolls back the delete along with the rejected insert.
**How it was verified:** Migration re-run against local Postgres alongside the full existing sequence — no conflicts. Directly tested all four tier/position combinations (both blocked cases, both allowed cases) against the trigger. Specifically for the atomicity fix: established a Tier 3 assignment via the RPC, attempted a rejected reassignment to a Tier 1 member (confirmed the same error message raises), then confirmed the original Tier 3 assignment was still intact — followed by confirming a legitimate Tier 3 → Tier 3 reassignment still succeeds normally. Also confirmed functions get default `PUBLIC` execute privilege in Postgres (unlike tables, which needed the explicit grant fix back in Entry 3) — no new grant migration needed for the `authenticated` role to call this RPC. `npm run build`/`lint`/`tsc --noEmit` all clean. Local dev server: unauthenticated requests to `/clusters/[id]/slots` still correctly redirect (303) to `/login`.
**Status:**  ✅ Complete and verified live — the rejected-reassignment bug was found, fixed, and re-verified directly against the production database and the live preview. This was the last slice of the KYC profiling feature.
**Case study:** [docs/case-studies/saamu-protected-head-bug-case-study.md](./docs/case-studies/saamu-protected-head-bug-case-study.md)


---

## Entry 5 (Slice 5) — Cycle Management

**What was built:** Turns slot assignments into an actual, trackable rotation, using the existing `cycles` table (real column names `slot_id`/`start_date`/`end_date`, not the `collector_slot_id`/`cycle_date` naming from the request — no rename, just first real use). A `/clusters/[id]/cycles` page: starts the first cycle (cycle 1, position 1, status `active`), completes the current cycle and advances to the next position in order, and — when the current collector slot is the last position — does *not* create a new cycle, instead marking the cluster's rotation complete ("Rotation complete — all positions have collected.", no auto-wrap to position 1). Both transitions are single Postgres functions (`start_first_cycle`, `advance_cycle`) called via `supabase.rpc(...)`, not sequential app-level writes — the same atomicity discipline as the Slice 4b fix, applied proactively this time instead of after a live bug. Also adds shared-slot co-collector support: `slots.is_shared` and `set_slot_members(slot_id, member_id[])`, generalizing the old single-member `reassign_slot_member` — a prerequisite gap found during scoping, since Slice 4a only ever supported one member per slot. Confirmed the existing protected-head trigger composes correctly with multi-member inserts (every co-collector on a shared protected position must individually be Tier 3), rather than assuming it.

**Guard rails:** only one `active` cycle per cluster, enforced two ways — the app-level check inside `advance_cycle`/`start_first_cycle` (clear error messages), and independently at the DB level via a partial unique index (`cycles_one_active_per_cluster on cycles (cluster_id) where status = 'active'`), confirmed live by bypassing the app entirely with a direct SQL insert attempt. An already-`completed` cycle cannot be re-completed or re-advanced. `clusters.status` (unused since Entry 1) now gets real meaning: `active` on first cycle start, `completed` when the rotation has no next position left.

**Migrations:** `20260723000000_add_slot_sharing.sql`, `20260723010000_cycle_management.sql`.

**Bug found and fixed live — end_date before start_date on the final cycle:** Completing the final cycle of a rotation (no next cycle to advance to) with the date field left blank wrote `end_date = today`, with no regard for the cycle's own `start_date` — producing an impossible end-before-start row whenever that cycle's `start_date` had been set later than today (e.g. a future-dated cycle from earlier manual testing, caught on Cluster 66). Root cause: `p_next_start_date` genuinely doesn't apply when there's no next cycle, yet `advance_cycle` used the same `coalesce(p_next_start_date, current_date)` fallback regardless. Fixed by computing one completion date used for *both* the completed cycle's `end_date` and the new cycle's `start_date`, floored to the current cycle's own `start_date` by default, and rejecting (rather than silently coercing) an explicit date earlier than the cycle's own start. Also added a `CHECK (end_date is null or end_date >= start_date)` constraint for defense in depth, with a one-time backfill of the existing bad row so the constraint didn't fail on data the old code already wrote. Migration: `20260723020000_fix_cycle_end_date_ordering.sql`.

**How it was verified:** Both cycle-management migrations re-run against local Postgres alongside the full existing sequence before ever going live — no conflicts. Full 3-position lifecycle (2 protected heads + 1 shared tail) run directly against the real RPCs locally first: start, block-duplicate-start, advance, block-re-advance-of-completed, shared co-collector display, end-of-rotation. Then the full 5-step test plan run live on Cluster 66: steps 1–3 (start first cycle, complete & advance, stop at rotation end) confirmed; the end_date bug was caught during step 3, reproduced locally, fixed, and re-verified live; step 4 confirmed by creating a fresh unprotected shared position, assigning two members via the checkbox interface, and confirming both persist as co-collectors after a hard refresh (plus a bonus check that the Tier 3 rule correctly rejects a Tier 1 member sharing a *protected* position); step 5's guard rails confirmed by bypassing the app entirely with direct SQL against the live production database — re-advancing an already-completed cycle correctly rejected, and inserting a second active cycle for a cluster that already has one correctly rejected at the database level by the unique constraint, not just app logic. `npm run build`/`lint`/`tsc --noEmit` all clean throughout.
**Status:** ✅ All 5 tests passed live. Ready to merge PR #11.

---

## Entry 6: Multi-tenancy with super-admin oversight

**Status:** Ready to merge

**What shipped:**
- `clusters.owner_id` (not null, references `auth.users`) — the tenant boundary,
  set once at creation, never transferred
- `admin_users.role` (`coordinator` | `super_admin`, default `coordinator`)
- RLS policies on every domain table: coordinators can do anything to their own
  data only; super-admins can SELECT (read-only) across everyone's data
- `createCluster` now stamps `owner_id` from the session
- `get_user_emails()` RPC resolves owner IDs to emails for oversight display

**Verification process:**
1. Manual live testing on the PR's Vercel preview URL (not production — an
   earlier attempt against production surfaced a false-positive RLS violation
   caused by testing unmerged code against already-migrated policies)
2. Confirmed: Coordinator B creates a cluster — correct `owner_id` set, visible
   only to her
3. Confirmed: super-admin sees all clusters across coordinators (read access)
4. Installed CodeRabbit (first use on this repo) for automated review as a
   second pass alongside manual testing

**Bugs found and fixed:**

1. Missing cross-cluster relationship checks (Major, security) — `slot_members`
   and `cycles` policies verified the coordinator owned the referenced cluster,
   but never checked that the linked record (`member_id`, `slot_id`) actually
   belonged to that same cluster. A coordinator could link records across
   tenants via a direct API request with a known cross-tenant UUID. Fixed by
   adding relationship checks to `WITH CHECK` on both policies.

2. `get_user_emails()` email leak (Major, security) — the function gated on
   `is_admin()`, true for both coordinators and super-admins, so any
   coordinator could pass arbitrary UUIDs and retrieve other tenants' emails.
   Fixed by restricting non-super-admin callers to their own `auth.uid()` only.

3. Owner column silently blank (functional) — found while updating the
   migration file: `get_user_emails()` returns a column named `id`, but
   `page.tsx` read `owner.user_id` from the result, so the Owner column
   resolved to `undefined` with no error. Fixed by updating `page.tsx` to
   read `owner.id`.

**Fix verification:** each fix applied live to production first, validated via
direct SQL, then backported into the migration file so a fresh environment
would create the policies/function correctly from scratch. CodeRabbit re-run
after both security fixes landed — clean, no remaining findings.

**Key process note:** manual UI-level testing did not surface either security
bug — both required a direct-API-request framing (crafted cross-tenant UUIDs)
that automated review caught and manual testing wouldn't naturally exercise.
Worth keeping CodeRabbit as a standing second pass on future RLS/auth changes.

---

## Entry 7: Payment/contribution tracking

**Status:** Ready to merge

**What shipped:**
- `payments.due_date` (new column, set to the owning cycle's `start_date`)
- `payments.payment_method` restricted to `cash` / `bank_transfer` / `mobile_money` via check constraint
- RLS fix on the "Coordinators manage their own payments" policy: both `USING` and `WITH CHECK` now verify the linked `member_id` belongs to the same cluster as `cycle_id`
- New trigger auto-creates one `pending` payment row per cluster member whenever a cycle is created (`amount = contribution_amount`, `due_date = cycle.start_date`) — every member pays every cycle, no one excluded, including that cycle's own collector
- New `/clusters/[id]/cycles/[cycleId]/payments` page: per-member payment status (amount, due date, status with a live-computed "Late" badge for pending payments past due date — never written to the DB, so no scheduled job is needed), Mark Paid / Waive / Revert to pending actions, and a summary block (pool, collected so far, outstanding count, net payout after the flat fee)
- Cycles page: a "View payments" link per cycle, and a non-blocking "N members still owe" notice near the active cycle's Complete & Advance button

**Verification process:**
1. Full migration sequence re-run locally from scratch (local Postgres with a minimal `auth` schema stub, since no Supabase CLI/credentials are available in this environment) — no conflicts
2. Direct-database tests: `start_first_cycle`/`advance_cycle` confirmed to auto-create correct payment rows; cross-cluster RLS attack (linking another cluster's member to this cluster's cycle) correctly rejected as a non-superuser `authenticated` role; invalid `payment_method` correctly rejected by the check constraint
3. CodeRabbit review on the PR, alongside manual triage of each finding
4. `npm run build`, `npm run lint`, `tsc --noEmit` all clean throughout
5. Live click-through on the Vercel preview: Mark Paid, Waive, and Revert to pending all confirmed working, pool/collected/outstanding math confirmed accurate

**Bugs found and fixed:**

1. **Backfill gap for pre-existing cycles** (functional) — found during live click-through testing: the `cycles_create_payments` trigger only fires on `INSERT`, so it never applied to a cycle that was already active before this migration ran. Test Cluster's existing Cycle 1 showed both members as "No payment record for this cycle" and Outstanding as 0, instead of Pending/2 — because the row genuinely didn't exist yet. Fixed by adding a one-time backfill (scoped to `active` cycles only, guarded with `NOT EXISTS` so it's safe to re-run) that creates the missing rows for any cycle already in progress.

2. **`USING` clause missing the same relationship check as `WITH CHECK`** (Major, security, via CodeRabbit) — `WITH CHECK` blocked new or updated cross-cluster mismatches, but `USING` still exposed (and permitted deleting) an existing malformed cross-cluster payment row to the cycle's coordinator. Fixed by adding the same member-cluster equality predicate to `USING`. Verified locally: a row inserted directly (bypassing RLS) linking another cluster's member to this cluster's cycle is now correctly invisible under the coordinator's own `SELECT`.

3. **Paid date rendered as a raw ISO timestamp** (cosmetic) — found during live click-through: `paid_at` is `timestamptz`, so it displayed as `2026-07-24T00:00:00+00:00` instead of a readable date, even though only a date is ever written to it. Fixed by slicing to the date portion, matching how `due_date`/`start_date`/`end_date` are already displayed elsewhere.

**CodeRabbit findings investigated and not applied:**
- Flagged `netPayout` as using the full pool instead of `collected` — this is intentional per the confirmed product spec (`pool − fee_amount` is the structural payout once everyone pays; `collected` already reports the running total separately). CodeRabbit reviewed the explanation and withdrew the finding.
- Flagged the payments view as being driven by the live `members` list rather than payment rows, in case membership changes later — confirmed this can't currently happen (no member-deletion feature exists, and `payments.member_id` cascades on member delete). CodeRabbit reviewed the explanation and withdrew the finding, noting it's worth revisiting only if member removal/deactivation is added later.

**Key process note:** live click-through testing caught both real bugs (the backfill gap and the timestamp rendering) that automated review and local-database testing didn't — a useful complement to Entry 6's finding that automated review catches what manual testing misses. Neither approach substitutes for the other.

**Case study (Entry 8, PR #14):** a "column does not exist" error on the clusters list was initially chased as a PostgREST schema-cache issue for several remediation attempts before the ground truth — the Entry 8 migration had simply never been applied to the live database — was confirmed directly. See [docs/case-studies/saamu-column-does-not-exist-bug-case-study.md](./docs/case-studies/saamu-column-does-not-exist-bug-case-study.md).
