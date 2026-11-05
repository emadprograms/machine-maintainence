---
phase: "3"
slug: "MM-03-machines-and-work-orders"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-05"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract. Requirements: REQ-04, REQ-05

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
| MM-03-01 | 01 | 1 | REQ-04 | — | Machine CRUD; technician cannot delete | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-03-02 | 01 | 1 | REQ-05 | — | Work order lifecycle with closed_at | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-03-03 | 01 | 1 | REQ-05 | — | Bad input returns 400 with a message, never 500 or SQL text | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |

*Status: ✅ green · ⬜ pending · ❌ red*

---

## Wave 0 Requirements

None — the test script has no install step, matching the project's no-dependencies constraint.

---

## Manual Verification Required

Windows execution of `start.bat` cannot be automated in this environment. Recorded as an
open item in `STATE.md`; it does not block the phase's automated criteria.
