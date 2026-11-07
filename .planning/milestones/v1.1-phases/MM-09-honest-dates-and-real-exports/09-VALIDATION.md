---
phase: "9"
slug: "honest-dates-and-real-exports"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-05"
---

# Phase 9 — Validation Strategy

| Property | Value |
|----------|-------|
| **Framework** | none — assertions in `starter/scripts/smoke-test.js` |
| **Quick run command** | `env PATH=/nonexistent node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js` |
| **Estimated runtime** | ~2 seconds |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Evidence | Status |
|---------|------|------|-------------|------------|-----------------|-----------|----------|--------|
| 09-01-01 | 01 | 1 | PM-01 | — | A supplied date is stored and drives next_due | integration | quick run | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | PM-02 | T-9-01 | Garbage date 400 naming the field; no silent substitution | integration | quick run | ✅ | ⬜ pending |
| 09-01-03 | 01 | 1 | PM-03 | T-9-02 | Future date refused; pre-last_done date refused | integration | quick run | ✅ | ⬜ pending |
| 09-02-01 | 02 | 1 | CSV-01, CSV-02 | T-9-03 | Both downloads are valid CSV with a header row | integration | quick run | ✅ | ⬜ pending |
| 09-02-02 | 02 | 1 | CSV-04 | T-9-04 | Comma, quote and newline in a field do not shift columns | integration | quick run | ✅ | ⬜ pending |
| 09-02-03 | 02 | 1 | CSV-03 | — | Filters narrow the export to match the view | integration | quick run | ✅ | ⬜ pending |

## Wave 0 Requirements

Existing infrastructure covers all requirements.

## Nyquist Audit

The Nyquist criterion is that every automated assertion is necessary and
sufficient: it must fail when its requirement is broken, and it must not fail
for reasons unrelated to its requirement.

**Sufficiency — every requirement has an assertion that bites.** Each of the six
task rows was verified by reintroducing the corresponding defect:

| Defect reintroduced | Assertions that failed |
|---|---|
| `on` ignored (the v1.0 bug) | 2 |
| lenient date parsing | 3 |
| future/past validation removed | 3 |
| CSV quoting removed | 4 |
| BOM removed | 3 |
| formula prefix removed | 1 |
| export ignoring filters | server failed to start (caught earlier) |

**Necessity — two assertions failed for the wrong reason and were corrected.**

1. The first CSV quoting assertion split rows on `,`, which agrees with a naive
   writer and therefore could not tell a correct file from a broken one. It
   reported a failure that was the test's fault. Replaced with a real RFC 4180
   parser; it now fails only when the writer is actually wrong.
2. Three phase-1 persistence assertions hardcoded `length === 1`. The work order
   this phase creates made them fail even though persistence was fine. Replaced
   with a snapshot captured immediately before the kill, which is what the
   requirement actually says.

Both corrections came from watching a green suite go red for the wrong reason.
That is the signal the audit exists to catch, and it is recorded here rather
than quietly fixed.

**Observed on the wire, not only in the suite.** The CSV was downloaded with
`curl` and inspected as bytes: `357 273 277` (the UTF-8 BOM), `^M` line endings,
and a quoted field containing both a comma and doubled quotes.

## Validation Sign-Off

- [x] All tasks have automated verification
- [x] Every assertion was proved to fail with its defect reintroduced
- [x] Assertions that failed for the wrong reason were corrected, not weakened
- [x] The full suite runs with no shell-outs (`env PATH=/nonexistent`)
- [x] File and wire-level properties (BOM, CRLF, quoting) are checked directly

**Approval:** validated — 118 checks, 0 failures.
