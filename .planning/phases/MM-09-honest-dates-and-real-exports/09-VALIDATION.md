---
phase: "9"
slug: "honest-dates-and-real-exports"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-05"
---

# Phase 9 — Validation Strategy

| Property | Value |
|----------|-------|
| **Framework** | none — assertions in `starter/scripts/smoke-test.js` |
| **Quick run command** | `env PATH=/nonexistent node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js` |
| **Estimated runtime** | ~2 seconds |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | PM-01 | — | A supplied date is stored and drives next_due | integration | quick run | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | PM-02 | T-9-01 | Garbage date 400 naming the field; no silent substitution | integration | quick run | ✅ | ⬜ pending |
| 09-01-03 | 01 | 1 | PM-03 | T-9-02 | Future date refused; pre-last_done date refused | integration | quick run | ✅ | ⬜ pending |
| 09-02-01 | 02 | 1 | CSV-01, CSV-02 | T-9-03 | Both downloads are valid CSV with a header row | integration | quick run | ✅ | ⬜ pending |
| 09-02-02 | 02 | 1 | CSV-04 | T-9-04 | Comma, quote and newline in a field do not shift columns | integration | quick run | ✅ | ⬜ pending |
| 09-02-03 | 02 | 1 | CSV-03 | — | Filters narrow the export to match the view | integration | quick run | ✅ | ⬜ pending |

## Wave 0 Requirements

Existing infrastructure covers all requirements.

## Validation Sign-Off

- [ ] All tasks have automated verification

**Approval:** pending
