---
phase: "6"
slug: "MM-06-windows-and-offline"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-05"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract. Requirements: REQ-08, REQ-09, REQ-11

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
| MM-06-01 | 01 | 1 | REQ-09 | — | Windows launchers exist with CRLF endings | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-06-02 | 01 | 1 | REQ-08 | — | No external URLs in shipped code | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-06-03 | 01 | 1 | REQ-08 | — | No runtime dependencies or native modules | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-06-04 | 01 | 1 | REQ-11 | — | README documents two worked modification recipes | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |

*Status: ✅ green · ⬜ pending · ❌ red*

---

## Wave 0 Requirements

None — the test script has no install step, matching the project's no-dependencies constraint.

---

## Manual Verification Required

Windows execution of `start.bat` cannot be automated in this environment. Recorded as an
open item in `STATE.md`; it does not block the phase's automated criteria.
