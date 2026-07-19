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
**How it was verified:** `npm run build`/`lint`/`tsc --noEmit` all clean. Local dev server: unauthenticated requests to the member add/edit/list routes still correctly redirect (303) to `/login`. The client-side upload path itself (and the fix for the 413) could not be exercised locally — this sandbox has no network path to the live Supabase project, and the routes require a real authenticated session to reach — so this still needs live verification, specifically with a realistic multi-MB phone photo this time.
**Status:** 🚧 Pending live verification (specifically: a real, several-MB photo upload) — slices 3, 4a, 4b not started
