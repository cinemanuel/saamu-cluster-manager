# Case Study: The "Column Does Not Exist" Bug That Wasn't a Caching Problem

**Project:** Saamu Cluster Manager
**PR:** #14 — Configurable coordinator payout fee system
**Date:** July 25, 2026
**Role:** Product/debugging lead, working with Claude (strategic debugging) and Claude Code (repo investigation)

---

## Summary

A Vercel Preview deployment for PR #14 consistently failed to load the clusters list, showing:

```text
Could not load clusters: column clusters.fee_type does not exist
```

This looked like — and was initially treated as — a PostgREST schema cache issue, since a prior session had already hit and partially resolved a similar-sounding cache problem. Four separate remediation attempts (schema reload, full project restart, environment variable correction, cache-disabled redeploy) all failed to fix it. The eventual root cause was much simpler than any of the theories tested: the migration that added the `fee_type` and `fee_value` columns had never actually been applied to the database. The error message was telling the literal truth the entire time.

## Symptom

Vercel Preview for branch `claude/payout-fee-system` returned:

```text
Could not load clusters: column clusters.fee_type does not exist
```

This occurred despite an earlier belief — stated at the start of this debugging session — that the columns had already been confirmed present via direct SQL against the live database.

## Investigation Timeline

1. **Initial hypothesis: stale PostgREST schema cache.** Consistent with a prior session's known issue. Ruled out after: `notify pgrst, 'reload schema'`, a full Supabase project restart, and a cache-disabled Vercel redeploy — none changed the outcome.

2. **Second hypothesis: Vercel Preview pointing at the wrong Supabase project.** Prompted by an unrelated auto-pause notification email referencing a different Supabase project ID than the one believed to be in use. Investigated via:
   - Listing all Supabase projects in the account and confirming the "real" project (`wxozwnacydmjyjjbrnuc`) was healthy and correctly configured.
   - Auditing Vercel's Environment Variables for `NEXT_PUBLIC_SUPABASE_URL` — found a single, non-duplicated entry scoped to Production + Preview, updated recently. No conflicting or stale duplicate entries.
   - This hypothesis was ruled out: configuration was clean.

3. **Third hypothesis: the code itself was misconfigured** (wrong env var name, hardcoded URL, or stray `.env` file). Delegated to Claude Code for a direct repo audit. Findings:
   - All three Supabase client files (`server.ts`, `client.ts`, `middleware.ts`) consistently used the same two correct env var names.
   - No hardcoded Supabase URLs anywhere in the codebase.
   - No `.env`/`.env.local`/`.env.production` files committed or present.
   - The relevant migration file's SQL exactly matched the columns the frontend query expected.
   - This hypothesis was ruled out: the code was clean.

4. **Decisive test: bypass Vercel and Next.js entirely.** A direct `curl` request to the Supabase REST API (PostgREST) for the `clusters` table's `fee_type` column, run independently from a local machine, returned the identical error. This proved the problem was neither a Vercel/env var issue nor a Next.js caching issue — it was genuinely the database.

5. **Fourth hypothesis: `clusters` was a view, not a base table**, and the view definition hadn't been updated to expose the new columns. Checked via `information_schema.tables`. Result: `clusters` is a `BASE TABLE`. Hypothesis ruled out.

6. **Root cause found:** A direct query of `information_schema.columns` for `public.clusters` listed all 11 real columns on the table — and neither `fee_type` nor `fee_value` was among them. The table did, however, have a legacy `fee_amount` column, suggesting the new fee-configuration columns were designed and migrated in the code (PR branch, migration file) but the corresponding `ALTER TABLE` had never actually been executed against the live database.

## Fix

This is the emergency interim patch applied live, in isolation, to confirm the diagnosis and unblock testing — **not** the canonical remediation:

```sql
ALTER TABLE public.clusters
  ADD COLUMN fee_type text,
  ADD COLUMN fee_value numeric(12,2);
```

Re-querying `information_schema.columns` confirmed 13 columns, including both new fields. Reloading the Preview deployment's clusters page confirmed clean data load with no errors.

The actual required fix for any environment is the complete migration already committed at `supabase/migrations/20260726000000_coordinator_payout_fee.sql`, which additionally backfills `fee_type`/`fee_value` from the legacy `fee_amount` column, locks `fee_type` to `not null`, adds the check constraints validating the fee configuration, and drops `fee_amount`. The bare `ALTER TABLE` above, applied on its own with no backfill or constraints, would leave existing clusters with `fee_type`/`fee_value` both `null` — an invalid state the app's validation doesn't expect. Applying only this interim snippet should never be treated as a substitute for running the full migration.

## Root Cause

The migration was never applied. Every earlier remediation attempt (cache reload, restart, redeploy, env var correction) was solving problems that didn't exist, because the underlying assumption — "the columns are there, something's just not seeing them" — was never actually re-verified with a direct, ground-truth query. The original belief that `fee_type`/`fee_value` had been confirmed via SQL earlier in the project appears to have been a misremembered or stale check.

## Key Learnings

1. **Re-verify foundational assumptions before debugging around them.** The entire investigation branched into cache/config/code theories before anyone ran the single query that would have shown the truth in seconds: listing the table's actual columns.
2. **An accurate error message is not evidence of environment confusion.** Once confirmed that the app's error-swallowing bug had recently been fixed (a separate, earlier commit), the error text should have been trusted as literal fact much sooner.
3. **Bypassing layers narrows scope fastest.** The single most valuable diagnostic step was the direct `curl` to PostgREST — it eliminated Vercel, Next.js, and env vars in one shot, at a point when three other theories were still competing for attention.
4. **"Table vs. view" is a cheap, high-value check** whenever a query claims a column doesn't exist despite a migration claiming to add it — a two-line `information_schema.tables` query rules an entire class of bugs in or out immediately.
5. **Manual migration workflows need a hard verification step.** Because migrations here are applied by hand via SQL Editor rather than an automated migration runner, there's no system-level guarantee that "I wrote the migration" equals "I ran the migration." A simple post-migration `information_schema.columns` check should be a standard last step of the migration process going forward, not something reached for only after extensive debugging.

## Process Note

This investigation was conducted collaboratively: Claude provided the debugging strategy, hypothesis sequencing, and exact step-by-step UI instructions (since execution happened entirely in the browser and Supabase/Vercel dashboards); Claude Code performed the direct repo-level code and migration file audit. The combination allowed ruling out entire categories of causes (code correctness, env var configuration) efficiently before the ground-truth database check surfaced the real issue.
