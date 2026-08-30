# Case Study: Supabase Keep-Alive Silently Failing Despite Green CI

**Project:** Saamu Cluster Manager
**PRs:** #17–#20 — Supabase keep-alive GitHub Actions workflow
**Date:** August 30, 2026
**Role:** Debugging lead, working with Claude Code (workflow implementation and root-cause investigation)

---

## Summary

A GitHub Actions workflow built specifically to stop Supabase's free-tier project from auto-pausing kept running successfully, every 3 days, always green — and the project still paused anyway. The green checkmark measured whether the Action completed, not whether it did the one thing it existed to do. Fixing it required two more iterations after the first "fix," and surfaced a second, unrelated permissions gap (a manually created table missing a table-level grant) along the way.

## Symptom

GitHub Actions workflow (Supabase keep-alive) ran successfully every 3 days,
always green, yet the Supabase project still auto-paused.

## Initial Hypothesis

The `/auth/v1/health` endpoint returns 200 without touching Postgres, so it
doesn't count as "database activity" for Supabase's pause detector — even
though the Action itself succeeds.

## Investigation

- Confirmed the cron schedule was firing reliably (not a scheduling bug) by
  reviewing Actions run history: 5 consecutive scheduled runs, all green,
  every 3 days — well inside Supabase's 7-day pause window.
- Confirmed via Supabase's own docs that pause criteria is based on "user
  database activity," not generic API traffic.
- Attempted a real database read as the fix, but hit RLS blocks:
  - `/rest/v1/` root is locked to `service_role`.
  - `/rest/v1/clusters` blocked by RLS requiring `is_admin()`.

## Root Cause

Two separate problems, found one after the other:

1. `/auth/v1/health` never touches Postgres, so it can't satisfy Supabase's
   activity requirement no matter how often it runs.
2. Real database tables were correctly locked down by RLS, so using them for
   a ping would have required weakening real security policies.

## Fix

Created a dedicated `system_heartbeat` table — single-row, no app data —
specifically for this purpose. Two permission layers had to both be set
correctly:

- An RLS policy granting `anon` SELECT (`using (true)`)
- A table-level GRANT: `grant select on public.system_heartbeat to anon;`

**Key lesson:** RLS policies only apply *after* a role already has table-level
access. Manually created tables in Supabase don't automatically grant `anon`
anything — the policy alone returned a 401 (`permission denied for table`)
even though the policy itself was correct.

## Verification

Manually triggered the workflow against the PR branch and confirmed the
printed `HTTP status: 200` in the Action log — not just a green checkmark,
since the whole incident began with a green checkmark that meant nothing.

## Process Note

A green CI check does not guarantee the check is testing what you think it's
testing. When a "should be working" system silently fails, verify what the
passing check actually touches, not just whether it passes.
