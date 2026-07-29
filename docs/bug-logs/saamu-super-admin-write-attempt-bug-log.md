# Bug Log: Super-Admin Sees Raw RLS Error Instead of Hidden Write Controls

**Project:** Saamu Cluster Manager
**Found during:** Manual testing of PR #15 (Coordinator Dashboard, Entry 9) — super-admin read-only verification
**Date:** July 29, 2026
**Severity:** Low (UX only — confirmed not a security issue)

## What happened

Signed in as the super-admin test account, navigated to another coordinator's cluster, and opened "New member." The form rendered fully, with a working "Add member" button — no visual indication that this account isn't supposed to write here. Submitting the form returned:

```text
new row violates row-level security policy for table "members"
```

## Why it happened

This was flagged as a known, pre-existing gap during PR #15's scoping (before any code was written): no page in the app checks the caller's role before rendering write controls (Edit/Assign/Mark Paid/Add/etc.) — every write action relies entirely on the database's Row Level Security policies to reject the actual attempt server-side. The Slice 9 dashboard was deliberately scoped to be the first page in the app to branch its UI by role (hiding write actions and showing an explicit "read-only" banner for super-admins) — but that scoping decision explicitly did not extend to retrofitting the older pages (Members, Cycles, Payments, etc.), to avoid expanding the slice's scope.

This test confirms that decision's tradeoff directly, rather than leaving it as a theoretical prediction: the gap is real and reproducible.

## Why it mattered

Security is not at risk — the RLS policy did exactly its job, and no data was written. The impact is purely user experience: a super-admin doing legitimate oversight work will occasionally hit a raw Postgres error message instead of simply not seeing a button that was never going to work. This is confusing, unprofessional-looking, and would look like the app is broken to anyone encountering it without full context of why.

## Fix applied

None yet — deliberately deferred, per the scoping decision made before PR #15 was built.

## Recommended follow-up

Retrofit the same role-check pattern used on the new dashboard (checking `is_super_admin()` and conditionally hiding write UI) onto the older Members, Rotation, Cycles, and Payments pages. This is a contained, mechanical change (copy an established pattern to a few more pages) rather than new design work, so it's a good candidate for a quick follow-up slice (Entry 9b) rather than something that needs to block PR #15's merge.
