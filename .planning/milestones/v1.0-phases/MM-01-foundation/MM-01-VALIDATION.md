---
phase: "1"
slug: "MM-01-foundation"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-05"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract. Requirements: REQ-01, REQ-10, REQ-11

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
| MM-01-01 | 01 | 1 | REQ-01 | — | Database file opens in WAL mode; writes commit atomically | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-01-02 | 01 | 1 | REQ-11 | — | ensureColumn adds a missing column without data loss | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-01-03 | 01 | 1 | REQ-01 | — | GET requests do not modify the database file | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-01-04 | 01 | 1 | REQ-10 | — | Backup writes a valid standalone database | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |

*Status: ✅ green · ⬜ pending · ❌ red*

---

## Wave 0 Requirements

None — the test script has no install step, matching the project's no-dependencies constraint.

---

## Manual Verification Required

Windows execution of `start.bat` cannot be automated in this environment. Recorded as an
open item in `STATE.md`; it does not block the phase's automated criteria.
