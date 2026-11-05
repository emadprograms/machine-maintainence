---
phase: "12"
slug: "the-front-door"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-05"
---

# Phase 12 — Validation Strategy

| Property | Value |
|----------|-------|
| **Framework** | none — assertions in \`starter/scripts/smoke-test.js\` |
| **Quick run command** | \`env PATH=/nonexistent node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js\` |
| **Estimated runtime** | ~4 seconds |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Evidence | Status |
|---------|------|------|-------------|------------|-----------------|-----------|----------|--------|
| 12-01-01 | 01 | 1 | DASH-01 | T-12-03 | Four sections, counts in SQL, lists capped | integration | 3 suite checks + live probe | ✅ passed |
| 12-01-02 | 01 | 1 | DASH-02 | T-12-02 | Summary cannot disagree with its list | integration | card==list, close-and-recount | ✅ passed |
| 12-01-03 | 01 | 1 | DASH-04 | T-12-01 | No user data in the payload | integration | 4 payload assertions + 401 | ✅ passed |
| 12-02-01 | 02 | 2 | DASH-02 | T-12-04 | Every field escaped | unit (DOM) + structural | 14 jsdom checks, per-field suite checks | ✅ passed |
| 12-02-02 | 02 | 2 | DASH-05 | T-12-05 | Failure ≠ empty | unit (DOM) | error render has no counts | ✅ passed |
| 12-02-03 | 02 | 2 | DASH-03 | — | Cards navigate to owning screens | unit (DOM) + integration | click-through, exact hrefs | ✅ passed |

## Nyquist Audit

**Sufficiency.** Nine mutations. Six failed immediately. Three survived, which is
the finding: each of those three asserted presence rather than correspondence —
the bug could be live and the check still green. All three were rewritten to
assert the relationship (count vs list, field vs escape, link vs owner) and each
now fails.

**What this says about the pattern.** Across phases 10, 11 and 12 the surviving
mutations were always the same shape. The rule that would have prevented all of
them: for any assertion that something is *linked*, *counted* or *covered*, break
the link and confirm the assertion fails before trusting it.

**The honest gap.** The DOM harness needs jsdom, which the zero-dependency rule
forbids, so it runs during verification only. Committed assertions are structural
plus HTTP; a purely visual regression is caught by neither.

## Validation Sign-Off

- [x] All tasks have automated verification
- [x] Every assertion proved to fail when its feature was removed
- [x] The three that survived first are recorded, with why
- [x] The DOM gap stated

**Approval:** validated — 171 checks, 0 failures.
