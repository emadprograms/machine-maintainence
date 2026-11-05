---
phase: MM-02-auth-and-users
verified: 2026-11-05T08:06:48Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - .planning/phases/MM-02-auth-and-users/MM-02-01-PLAN.md
  - .planning/phases/MM-02-auth-and-users/MM-02-01-SUMMARY.md
  - starter/auth.js
  - starter/server.js
covered_digest: "v4:sha256:469d99a35090f7cdf30fc51ecc6499fab1c7325fcb5a898c004f90c9c84f131a"
behavior_unverified: 0

---

# Phase 2: Auth & users Verification Report

**Phase Goal:** See `.planning/ROADMAP.md` phase 2
**Verified:** 2026-11-05
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Passwords hashed with scrypt | ✓ VERIFIED | stored value begins scrypt$; user list contains no hash |
| 2 | No hardcoded secret in source | ✓ VERIFIED | secret generated into data/secret.txt; grep finds no literal |
| 3 | Unauthenticated reads rejected | ✓ VERIFIED | smoke test: GET /api/equipment -> 401 |
| 4 | Logout revokes server-side | ✓ VERIFIED | cookies map entry deleted; cookie cleared |
| 5 | No public registration route | ✓ VERIFIED | route table contains no /register entry |
| 6 | Technician cannot create users, read the staff list, or delete machines | ✓ VERIFIED | smoke test: 403 on all three (the read check was added post-ship; see bug #11) |
| 7 | Disabled user rejected at login | ✓ VERIFIED | smoke test: 403 'This account has been disabled' |
| 8 | Admin cannot disable own account | ✓ VERIFIED | smoke test: 400, after fixing boolean-vs-0 comparison |

## Required Artifacts

All files listed in the plan exist in `starter/`.

## Anti-Patterns Found

| Pattern | Result |
|---|---|
| Whole-file database rewrite per request | absent — SQLite WAL |
| Hardcoded signing secret | absent — generated per install |
| Self-registration endpoint | absent — no route |
| Fake/derived maintenance dates | absent — real `next_due` column |
| External CDN / font fetch | absent — audited |

## Behavioral Verification

Automated: `starter/scripts/smoke-test.js` (47 checks) and
`starter/scripts/audit-offline.js` for phase 6.

No human verification outstanding for this phase.

## Overall Verdict

PASSED — every must-have has automated evidence.
