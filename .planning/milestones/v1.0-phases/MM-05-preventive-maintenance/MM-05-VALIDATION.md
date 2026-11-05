---
phase: "5"
slug: "MM-05-preventive-maintenance"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-05"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract. Requirements: REQ-07

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | custom Node script (no dependencies) |
| **Config file** | none — the script starts its own server on port 3999 |
| **Quick run command** | `node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js` |
| **Full suite command** | same, plus `starter/scripts/audit-offline.js` |
| **Estimated runtime** | ~40 seconds |

---

## Sampling Rate

- **After every change:** run the smoke test
- **Before closing the milestone:** full suite green (45 checks) + offline audit passes
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| MM-05-01 | 01 | 1 | REQ-07 | — | Schedule stores interval and next due date | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-05-02 | 01 | 1 | REQ-07 | — | Due Soon window ordered with overdue first | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-05-03 | 01 | 1 | REQ-07 | — | Mark done rolls next_due exactly interval_days | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |

*Status: ✅ green · ⬜ pending · ❌ red*

---

## Wave 0 Requirements

None — the test script has no install step, matching the project's no-dependencies constraint.

---

## Manual Verification Required

Windows execution of `start.bat` cannot be automated in this environment. Recorded as an
open item in `STATE.md`; it does not block the phase's automated criteria.
