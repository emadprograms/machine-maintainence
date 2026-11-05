---
phase: "7"
slug: "parts-become-maintainable"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-05"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — hand-rolled assertions in `starter/scripts/smoke-test.js` |
| **Config file** | none (Node built-ins only, no test runner) |
| **Quick run command** | `env PATH=/nonexistent node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js` |
| **Full suite command** | quick run, plus `node --no-warnings=ExperimentalWarning starter/scripts/audit-offline.js` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green, including `OFFLINE-SAFE`
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PART-01 | T-7-02 | Restock rejects a negative quantity instead of clamping | integration | quick run | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | PART-02 | T-7-02 | Partial PUT cannot blank an untouched field | integration | quick run | ✅ | ⬜ pending |
| 07-01-03 | 01 | 1 | PART-03 | T-7-03 | Unused part deletes; row is gone from the list | integration | quick run | ✅ | ⬜ pending |
| 07-01-04 | 01 | 1 | PART-04 | T-7-03 | In-use part delete returns 400 naming the job, not a raw FK error | integration | quick run | ✅ | ⬜ pending |
| 07-02-01 | 02 | 1 | PART-05 | T-7-01 | `reorder_level` migrates an existing DB file | integration | quick run | ✅ | ⬜ pending |
| 07-02-02 | 02 | 1 | PART-05 | — | Badge fires at exactly `qty == reorder_level` | integration | quick run | ✅ | ⬜ pending |
| 07-02-03 | 02 | 1 | PART-02, PART-05 | T-7-02 | Two parts at the same qty with different levels badge differently | integration | quick run | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. `smoke-test.js` already starts a
throwaway server on port 3999, seeds a part, consumes it on a work order, and asserts the
stock rollback — the new assertions attach to that same fixture rather than starting a
second harness.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inline edit row is usable on a narrow window | PART-02 | CSS layout under ~500px is not asserted by any automated check | Narrow the browser to half a laptop screen, click Edit on a part, confirm all fields stay reachable |

*Everything else has automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
