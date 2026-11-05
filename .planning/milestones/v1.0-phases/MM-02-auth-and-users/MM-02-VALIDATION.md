---
phase: "2"
slug: "MM-02-auth-and-users"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-05"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract. Requirements: REQ-02, REQ-03

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
| MM-02-01 | 01 | 1 | REQ-02 | — | Passwords stored as scrypt hashes, never plaintext | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-02-02 | 01 | 1 | REQ-02 | — | Signing secret generated per install, absent from source | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-02-03 | 01 | 1 | REQ-02 | — | Logout revokes the session server-side | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-02-04 | 01 | 1 | REQ-03 | — | Only admins can create users; no public route | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |
| MM-02-05 | 01 | 1 | REQ-02 | — | Disabled users rejected at login and on next request | integration | `node scripts/smoke-test.js` | ✅ | ✅ green |

*Status: ✅ green · ⬜ pending · ❌ red*

---

## Wave 0 Requirements

None — the test script has no install step, matching the project's no-dependencies constraint.

---

## Manual Verification Required

Windows execution of `start.bat` cannot be automated in this environment. Recorded as an
open item in `STATE.md`; it does not block the phase's automated criteria.
