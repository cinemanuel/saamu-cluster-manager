# Bug Log: Rotation Position Field Accepts Unvalidated Numbers

**Project:** Saamu Cluster Manager
**Found during:** Manual testing of PR #15 (Coordinator Dashboard, Entry 9)
**Date:** July 29, 2026
**Severity:** Low (data-quality issue, not a functional break)

## What happened

While setting up test data for a dashboard edge case, cluster 99's second rotation position was found stored as `position = 12` instead of `position = 2`. The cluster only ever had 2 members and 2 intended positions — this was a stray digit typed into the "Position" number field on the "Add position" form at some earlier point.

## Why it happened

The "Add position" form's Position field is a free-entry number input with no validation constraining it to a sensible range (e.g., 1 through the cluster's member count). Nothing in the UI or the database stops a coordinator from typing `12` when they meant `2` — a very easy mistake to make.

## Why it mattered

Rotation order (`advance_cycle`) works by finding the next slot where `position > current_position`, ordered ascending, so a stray high number like `12` wouldn't immediately break the rotation — but it would silently make the rotation's actual sequence not match what a coordinator believes they set up, and could cause confusing behavior later (e.g., if they later add a real "position 3 through 11," those would each be reached before the mistyped slot, pushing what was meant to be the very next collector to the end of the queue instead).

## Fix applied (this instance)

Corrected directly via SQL:

```sql
UPDATE public.slots SET position = 2 WHERE id = '94add535-8d4f-4263-8ca2-fd5eace060bf';
```

Verified via a follow-up `SELECT` that the value changed correctly.

## Recommended follow-up (not yet done)

Add validation to the "Add position" form — either a `CHECK` constraint on `public.slots.position` (e.g., must be between 1 and some reasonable max) or client-side validation tying the allowed range to the cluster's current member count. This is a fast-follow, not urgent, since the underlying rotation logic tolerates it — but it's a real gap worth closing before onboarding real external coordinators, who won't have someone checking their SQL for typos.

## Related note

A second, related usability gap was also observed in this same session: clicking "Assign" on a rotation position gives no visible success or error feedback. It was confirmed (via hard refresh) that assignments do save correctly — this is a pure UX gap, not a functional bug — but it's worth fixing alongside the position-validation issue, since both are in the same part of the app and both erode trust for a first-time user.
