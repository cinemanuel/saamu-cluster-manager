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
**How it was verified:** Ran the local test-Postgres migration check again (constraint rejects a zero fee and a negative contribution amount, accepts a valid row). `npm run build`/`lint`/`tsc --noEmit` all clean. Confirmed locally that `/clusters`, `/clusters/new`, and `/clusters/[id]/edit` all correctly 307-redirect to `/login` when unauthenticated. Full create/edit/list flow against real data has not yet been exercised — needs to be verified live against the deployed app (steps provided separately) since this sandbox can't reach the live Supabase project.
**Status:** 🚧 Pending live verification — member management (slice 2) not started
