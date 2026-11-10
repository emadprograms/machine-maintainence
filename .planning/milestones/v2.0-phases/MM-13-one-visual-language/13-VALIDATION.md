---
phase: "13"
slug: "one-visual-language"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-05"
---

# Phase 13 — Validation Strategy

| Property | Value |
|----------|-------|
| **Framework** | none — assertions in \`starter/scripts/smoke-test.js\` |
| **Quick run command** | \`env PATH=/nonexistent node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js\` |
| **Estimated runtime** | ~4 seconds |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Evidence | Status |
|---------|------|------|-------------|------------|-----------------|-----------|----------|--------|
| 13-01-01 | 01 | 1 | SCREEN-01 | — | A header on every screen | structural + DOM | 2 suite checks, 3 DOM checks | ✅ passed |
| 13-01-02 | 01 | 1 | SCREEN-02 | T-13-02, T-13-03 | Forms in dialogs, closable | structural + DOM | 5 suite checks, 6 DOM checks | ✅ passed |
| 13-01-03 | 01 | 1 | SCREEN-02b | T-13-01 | No screen opens with a form | structural + DOM | 2 suite checks, mutation-proved | ✅ passed |
| 13-02-01 | 02 | 2 | SCREEN-03 | T-13-06 | Rows styled as records | structural (CSS) | 5 suite checks, mutation-proved | ✅ passed |
| 13-02-02 | 02 | 2 | SCREEN-04 | T-13-04, T-13-05 | Empty ≠ broken | structural + DOM | 3 suite checks, 2 DOM checks | ✅ passed |
| 13-02-03 | 02 | 2 | SCREEN-05 | — | Delete names what it destroys | structural | 2 suite checks, mutation-proved | ✅ passed |

## Nyquist Audit

**Sufficiency.** Six features broken, six caught.

**The one that needed three attempts.** "A failed load does not render as an
empty list" was:
1. **a false positive** — matched the word "catch" in a doc comment;
2. **a false negative after being fixed** — inspected catch bodies, but the
   defect is a catch that falls *through*, so the body is innocent;
3. **correct** only after asking whether a loader can turn a failed fetch into an
   empty list, and stripping comments before matching.

Both wrong versions were green. The lesson, now written into the assertion's own
comment: a check can be wrong in two directions at once, and only reintroducing
the defect in every shape reveals it.

**The honest gap.** jsdom has no layout engine. Every claim about appearance is a
claim about *rules and structure*, not about what a person sees. For a phase whose
entire purpose is appearance, that is the largest such gap in the milestone.

## Validation Sign-Off

- [x] All tasks have automated verification
- [x] Every assertion proved to fail when its feature was removed
- [x] The two wrong versions of one assertion are recorded, with why
- [x] The visual gap stated plainly

**Approval:** validated — 189 checks, 0 failures. Appearance not seen.
