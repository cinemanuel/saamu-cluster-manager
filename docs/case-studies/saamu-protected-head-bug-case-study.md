# Case Study: The Protected-Head Reassignment Bug
### Saamu Cluster Manager — Slice 4b (Protected-Head Slot Enforcement) — PR #10

**Role:** Product Operations Manager / Builder
**Project:** Saamu Cluster Manager — a rotational savings (Ajo) coordinator tool
**Repo:** `cinemanuel/saamu-cluster-manager`
**Build tool:** Claude Code (session: "Supabase setup with Next.js")

---

## 1. The Feature

Saamu Cluster Manager runs Ajo/rotational-savings clusters, where members are assigned to numbered rotation positions to receive collective payouts in sequence. Slice 4b added a business rule: **positions 1 and 2 ("First to collect" and "Second Head") are protected — they can only be held by members who have reached KYC Tier 3.** This is a trust safeguard: the earliest, highest-risk payout slots go only to the most-verified members.

The rule was implemented as a Postgres trigger (`enforce_protected_head_slot`) firing on insert/update to the `slot_members` table, rejecting any assignment to position 1 or 2 if the member's `kyc_tier` was below 3.

## 2. The Test Plan

Before merging, I designed a 5-step test plan specifically to check both the *rule* and its *edges* — not just the happy path:

1. Assign a Tier 1/2 member to Position 1 → should show a clear inline error, not save
2. Same test on Position 2 → same block
3. Assign that same non-Tier-3 member to Position 3 (unprotected) → should succeed normally
4. Assign a genuine Tier 3 member to Position 1 or 2 → should succeed
5. **Reassign** Position 1 or 2 away from an already-assigned Tier 3 member to a lower-tier member → should still be blocked

Step 5 was deliberately the hardest test. Steps 1–4 only prove the rule works on an *empty* slot (an `INSERT`). Step 5 tests whether the same rule holds when the slot is already **occupied** and being changed (an `UPDATE` / reassignment) — a classic gap where a developer validates on create and forgets to re-validate on update.

## 3. Steps 1–4: Clean Pass

Working directly on the PR #10 preview deployment (never the production `main` branch, and never trusting a "should work" claim without a screenshot):

- **Step 1:** Tier 2 member → Position 1. Correctly rejected with `"Position 1 requires a Tier 3 member (this member is Tier 2)."`
- **Step 2:** Same member → Position 2 ("Second Head"). Correctly rejected with the equivalent message.
- **Step 3:** Same member → Position 3 (unprotected). Accepted, and confirmed to persist after a full page refresh — proving the rule was correctly scoped to positions 1 & 2 only, not applied globally.
- **Step 4:** Two genuine Tier 3 members (Emmanuel Kalasuwe, Kelebe John) assigned to Positions 1 and 2. Both accepted and persisted after refresh.

At this point, four of five tests looked clean. It would have been easy to call the feature done here.

## 4. Step 5: The Bug

I put a genuine Tier 3 member (Emmanuel Kalasuwe) in Position 1, then attempted to reassign that same position to a non-Tier-3 member (Pelumi).

**Expected:** the same red inline error, and the original Tier 3 member still shown after refresh.

**Actual:** the inline error appeared correctly — but on refresh, Position 1 reverted to **"Unassigned."** The original valid assignment had been silently wiped, even though the reassignment attempt was rejected.

This was worse than "the rule doesn't work" — the protected position was left *empty* and *undefined*, which is precisely the failure state the rule exists to prevent.

## 5. Root Cause #1 (found, but not the whole story)

Tracing the code with Claude Code, the diagnosis was: the `assignMember` function performed a `DELETE` (clear the old assignment) followed by a separate `INSERT` (write the new one) as **two independent, non-atomic PostgREST requests**. When the trigger rejected the `INSERT`, the `DELETE` had already committed — so the rejection didn't roll back the earlier deletion.

**Fix #1:** Both statements were wrapped inside a single atomic Postgres function, `reassign_slot_member`, called via `supabase.rpc(...)`. A single RPC call is one transaction — if the insert is rejected, the whole transaction (delete included) rolls back together.

This fix was written and a new migration (`20260722010000_atomic_slot_reassignment.sql`) was applied to the database.

## 6. Re-Testing: The Bug Persisted

Applying "the fix exists" is not the same as "the fix works." I re-ran the exact Step 5 scenario on the live preview link.

**Result: identical failure.** Pelumi was rejected with the correct error message — but on refresh, Emmanuel's assignment was still wiped to "Unassigned."

This is the point where a shallower process might have declared victory based on the code looking correct, or based on the fix having been "committed." Instead, this discrepancy triggered a systematic elimination process, ruling out each layer one at a time:

- **Was the migration actually applied?** Confirmed via direct query: `select proname from pg_proc where proname = 'reassign_slot_member';` returned the function — it existed in the database.
- **Was the deployment stale?** Confirmed via GitHub that the preview deployment for the fix commit (`dc81bb0`) had finished building and was serving current code.
- **Was the trigger silently swallowing the rejection (`RETURN NULL`) instead of raising a real exception?** Read the actual trigger source directly — confirmed it used `RAISE EXCEPTION`, the correct pattern, which should force a full rollback.
- **Was there a stray client-side write bypassing the RPC?** Traced every `.insert()/.update()/.delete()/.rpc()` call in the codebase — confirmed `slot_members` was touched in exactly one place, the `reassign_slot_member` RPC call. No separate unassign/clear step existed anywhere in the frontend or Server Action.

Each of these ruled out one hypothesis, but none explained the actual symptom.

## 7. Isolating the Bug: Testing the Database Directly

The one thing that hadn't been tested in true isolation was the **live production database itself**, independent of the app. I ran the exact failing scenario directly in the Supabase SQL Editor, step by step:

1. Retrieved the real `slot_id` for Cluster 66, Position 1, and the real `member_id` values for Pelumi and Emmanuel.
2. Discovered Position 1 was, in fact, currently empty in production — confirming the data loss was real, not a display artifact of the app alone.
3. Restored Emmanuel via a direct call to `reassign_slot_member`, and confirmed the row was correctly written.
4. Called `reassign_slot_member` again with Pelumi's ID directly in SQL (bypassing the app, the browser, and any frontend state entirely).
5. The function threw the exact same error text seen in the browser: `"Position 1 requires a Tier 3 member (this member is Tier 2)."`
6. Immediately queried `slot_members` again: **Emmanuel's row was completely unchanged — same `assigned_at` timestamp as before the rejected call.**

This was the conclusive test. It proved, with no ambiguity, that **the database, the function, and the trigger were all working correctly.** The atomic-transaction fix genuinely worked. The bug had to be somewhere between the browser and the database — a layer that had, until now, been assumed safe because "the code looked right."

## 8. Root Cause #2: A Silent Display-Layer Failure

With the database eliminated as a suspect, this evidence was reported back to Claude Code as a finding, not a question — directing the investigation to the one place left unexamined: how the frontend *displays* the assignment, not how it *writes* it.

The actual cause: the slots list page resolved the assigned member's name via an embedded `members(full_name)` join through the `slot_members` query. If that embed failed to resolve for any reason (schema-cache timing was the suspected trigger), the page's `if (member)` check would silently treat a **valid, untouched assignment** as absent — rendering "Unassigned" even though the underlying row was completely intact.

This explained everything: the database was never wrong. The *page* was lying about what the database contained.

**Fix #2:** Removed the fragile embedded join. The page was changed to resolve the assigned member's name from the plain `members` list it already loads for the assignment dropdown, rather than trusting a join that could silently fail.

Notably, Claude Code was explicit that this fix was **not proven with the same certainty as the first one** — it could reproduce the atomicity bug locally before and after the fix, but could not reach the live Supabase project to reproduce this exact symptom. It described this as "a real class of bug that would produce exactly what you're describing," not a confirmed root cause. That distinction mattered — it meant the fix still needed independent, live verification before being trusted.

## 9. Final Verification

After the new deployment finished building:

1. Confirmed Emmanuel displayed correctly in Position 1 on the live preview link (with a new "Requires Tier 3" badge now shown directly on Positions 1 and 2 — an incidental UX improvement from this pass).
2. Repeated the exact Step 5 scenario: attempted to reassign Position 1 to Pelumi.
3. Correct rejection error appeared.
4. **Refreshed the page. Emmanuel was still shown as assigned to Position 1.**

Combined with the earlier direct-database confirmation, this closed the loop from two independent directions: the database layer and the display layer were both now proven correct, not just individually claimed to be fixed.

A final regression check confirmed Position 2 still correctly blocked non-Tier-3 members after this display-logic change, ruling out any collateral damage from the fix.

## 10. Merge and Closure

PR #10 was merged into `main` on GitHub only after this full verification — not on the strength of a fix being written, committed, or even deployed. This closed out **Entry 4 (KYC Profiling)** in the project's `BUILD_LOG.md`.

## 11. What This Demonstrates

- **A test plan designed around edge cases, not just happy paths.** The bug that mattered most lived in test 5 of 5 — the one testing update behavior on an already-valid state, not creation from empty.
- **Refusal to accept "should be fixed" without re-verification.** The first fix (atomic RPC) was real and necessary, but insufficient — and only re-testing the exact original scenario, not a new one, surfaced that.
- **Systematic elimination over guessing.** Each hypothesis (stale migration, stale deployment, silent trigger, stray client write) was tested and ruled out individually, in order, rather than jumping to conclusions.
- **Isolating layers to find truth.** Testing the database directly, independent of the app, was the pivotal move — it proved definitively that a plausible root cause (the trigger, the function) was *not* the actual cause, redirecting the entire investigation to the correct layer.
- **Honest handling of uncertainty.** The second fix was pursued and merged only after the same rigor was applied to it as the first — despite the AI-assisted diagnosis itself flagging lower confidence in that root cause.

The end state: a genuinely verified fix, a documented root cause with two distinct failure modes (a data-integrity bug and a display-integrity bug), and a paper trail — this document, the PR history, and the migration files — that shows the reasoning, not just the result.
