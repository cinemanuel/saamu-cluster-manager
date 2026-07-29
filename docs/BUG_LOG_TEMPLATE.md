# Bug Log Template (Quick Version)

Use this for small/medium bugs found during normal testing — typos, minor UI gaps, small logic errors. For anything that required real multi-step investigation (multiple hypotheses tested and ruled out), use the full case-study format instead (see `docs/case-studies/` for examples).

Copy the block below, fill it in, save as `docs/bug-logs/<short-name>-bug-log.md`, and cross-reference it from the relevant BUILD_LOG.md entry with one line: `See docs/bug-logs/<short-name>-bug-log.md for details.`

---

```markdown
# Bug Log: <Short Descriptive Title>

**Project:** Saamu Cluster Manager
**Found during:** <what you were testing when you found it, e.g. "PR #15 manual test plan">
**Date:** <date>
**Severity:** <Low / Medium / High>

## What happened
<1-3 sentences: the observable symptom>

## Why it happened
<1-3 sentences: the actual root cause, once known>

## Why it mattered
<1-2 sentences: what would go wrong for a real user if left unfixed>

## Fix applied
<the actual fix — code diff, SQL, or config change>

## Recommended follow-up
<anything not fixed yet that should be, or "None — fully resolved.">
```

---

## When to use the FULL case-study format instead

Use the longer format (see existing files in `docs/case-studies/`) when:
- You tested more than one hypothesis before finding the real cause
- The investigation itself teaches a reusable lesson about debugging process, not just about this one bug
- It's a good showcase piece for demonstrating rigorous problem-solving (useful for portfolio purposes)

Use this quick template when:
- The cause was found quickly, or was a simple mistake (typo, missing validation, missing UI feedback)
- There's little value in narrating a "investigation timeline" because there wasn't much of one
