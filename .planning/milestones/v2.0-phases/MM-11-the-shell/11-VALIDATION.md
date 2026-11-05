---
phase: "11"
slug: "the-shell"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-05"
---

# Phase 11 — Validation Strategy

| Property | Value |
|----------|-------|
| **Framework** | none — assertions in `starter/scripts/smoke-test.js` |
| **Quick run command** | `env PATH=/nonexistent node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js` |
| **Estimated runtime** | ~3 seconds |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Evidence | Status |
|---------|------|------|-------------|------------|-----------------|-----------|----------|--------|
| 11-01-01 | 01 | 1 | NAV-01 | T-11-02 | The sidebar renders one entry per page from the same PAGES array | structural + DOM | "the sidebar exists", "every page has a matching section" | ✅ passed |
| 11-01-02 | 01 | 1 | NAV-02 | T-11-03 | Collapse works, persists, and degrades safely when storage fails | structural + DOM | "the collapsed state is read defensively", 3 DOM checks | ✅ passed |
| 11-01-03 | 01 | 1 | NAV-01 | T-11-04 | The toggle is a button with aria-expanded | structural + DOM | "the toggle reports its state with aria-expanded" | ✅ passed |
| 11-02-01 | 02 | 2 | NAV-03 | T-11-01 | A technician sees five entries, no Users/Backup | DOM | 2 DOM checks, 5 entries rendered | ✅ passed |
| 11-02-02 | 02 | 2 | NAV-03 | T-11-01 | Hiding a link is not access control | integration | pre-existing 403 assertions unchanged | ✅ passed |
| 11-02-03 | 02 | 2 | NAV-04 | — | No screen moved: pages↔sections correspondence both ways | structural | 2 mutation-proved assertions | ✅ passed |

## Nyquist Audit

**Sufficiency.** Each of the four new features was broken and the suite re-run:
`aria-label` removed → 1 failure; `localStorage` guard removed → 1; a page deleted
from `PAGES` → 1; the tab row restored → 1. Nothing passed that should have failed.

**Necessity — a mutation that did not apply.** The first attempt at the
`localStorage` mutation was written as a Python heredoc with a syntax error, so
the file was unchanged and the suite passed. That was reported as "passed" in the
run log and briefly looked like a non-biting assertion. Re-applied correctly, the
assertion failed as it should. Recorded because a mutation test that silently does
not mutate is worse than no mutation test — it certifies an assertion it never
exercised.

**The honest gap.** These are source-level assertions; the suite cannot render
DOM. A rendered harness (jsdom, 14 checks) was used during verification and passed,
but cannot be committed under the zero-dependency rule. Structural checks catch
removed features, not visual regressions.

## Validation Sign-Off

- [x] All tasks have automated verification
- [x] Every assertion was proved to fail when its feature was removed
- [x] The one mutation that silently did not apply was re-run correctly
- [x] The DOM gap is stated rather than papered over

**Approval:** validated — 151 checks, 0 failures.
