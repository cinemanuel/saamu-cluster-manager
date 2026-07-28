# Case Study: A "Future Date" That Looked Like Test Data Noise, But Was a Real Mislabeling Bug

**Project:** Saamu Cluster Manager
**PR:** #15 — Coordinator Dashboard (Entry 9)
**Date:** July 28, 2026
**Role:** Product/testing lead, working with Claude (test planning and live verification) and Claude Code (implementation and code-level investigation)

## Summary

While manually testing the new coordinator dashboard against a pre-written edge-case test plan, a completed test cluster displayed a "Start date" of 2026-08-04 — a date in the future relative to the actual current date (July 28, 2026). The first instinct was to treat this as a data artifact from rapid test-cycle advancement rather than a real bug, and a quick cross-check against the cluster's Cycles page seemed to confirm that: the same cycle's `end_date` was also `2026-08-04`. Only by tracing the actual rendering code — rather than trusting that a matching value meant correct logic — was the real bug found: the dashboard's "Start date" tile was coded to display the last cycle's `end_date`, not its `start_date`, for a completed cluster. The two values only looked consistent because, for this particular test cycle, they coincidentally matched.

## Symptom

On the coordinator dashboard, a cluster with `status = 'completed'` showed:

```text
Status: Completed
Current cycle: Completed at cycle 3
Start date: 2026-08-04
```

`2026-08-04` is after the actual current date, which reads as suspicious for something that has already completed.

## Investigation Timeline

1. Initial read: "this is probably just test data." The cluster in question had been advanced through multiple cycles rapidly during earlier feature testing, without real calendar time passing between advances. Since `advance_cycle` accepts an optional `p_next_start_date` and doesn't require it to be `<= today`, it's entirely possible for a coordinator to legitimately complete a cycle with a forward-dated completion. This made a "synthetic test data" explanation plausible on its face.
2. First verification step: check the Cycles page for the same cluster directly. The Cycles page showed Cycle 3 with `Start: 2026-08-04` and `End: 2026-08-04` — identical values. This was initially read as confirming the "test data artifact" theory: the dates matched, so nothing seemed wrong.
3. The gap in that verification: matching values don't prove correct code. Checking the Cycles page confirmed the data was internally consistent, but it didn't check which field the dashboard was actually reading. Because this particular cycle's `start_date` and `end_date` happened to be the same value, the dashboard would have rendered the identical, seemingly-correct date regardless of which field its code was actually pulling from — masking a real bug behind a coincidence.
4. Root cause found via direct code inspection. Asking Claude Code to trace exactly which field the dashboard's "Start date" tile reads from (rather than continuing to reason about the data) found the actual bug immediately: for a completed cluster, `app/dashboard/page.tsx` rendered `lastCycle.end_date` under a label that says "Start date." For Cluster 66's Cycle 3, `start_date` and `end_date` were both `2026-08-04`, so the mislabeled field happened to display an unremarkable-looking value. For any completed cluster where those two dates differ (the normal case — a cycle typically starts on one date and completes roughly a week later), this bug would show the end date under the start date label, silently.

## Fix

Changed the completed-cluster branch of the "Start date" tile to read `lastCycle.start_date` instead of `lastCycle.end_date`. Verified via `tsc --noEmit`, `npm run lint`, and `npm run build`, all clean.

## Root Cause

A straightforward mislabeling bug introduced during the dashboard's initial build — the wrong field was wired to the "Start date" label for one specific status branch (completed clusters; the active-cluster branch reading `activeCycle.start_date` was correct). It went unnoticed until manual testing because the specific test cluster used had a coincidental data pattern (a cycle whose start and end date were identical) that made the bug's output look plausible.

## Key Learnings

1. A cross-check that confirms the data is consistent is not the same as a cross-check that confirms the code is correct. Checking the Cycles page ruled out "the database has bad data" — a valid and useful step — but it could not rule out "the dashboard is reading the wrong field," because both explanations would have produced the exact same visible result for this specific test case.
2. When a coincidence is possible, trace the code path directly rather than reasoning further about the data. The moment two independently-verified values matched by coincidence rather than necessity, the fastest and most reliable way forward was asking Claude Code to show the exact line of code producing the value — not generating further hypotheses about test data quality.
3. Edge-case test plans should include "does this cycle's start and end date differ?" as an explicit condition to test against, precisely because a test cluster where they happen to match is a poor test case for a bug like this one — it would have shipped invisibly if the specific test cluster's data had been shaped differently.
4. A suspicious-looking value is worth investigating even when a plausible non-bug explanation exists. "Test data can look weird" was a reasonable initial theory, and it very nearly ended the investigation prematurely — treating it as a hypothesis to verify, rather than a conclusion, is what actually surfaced the bug.

## Process Note

This bug was found through disciplined manual click-through testing against a pre-written test plan (rather than assuming a newly-built feature works because it typechecks and builds cleanly), and was correctly diagnosed only by escalating from "check the data" to "check the code" once the data-level check produced an ambiguous, coincidence-shaped result.
