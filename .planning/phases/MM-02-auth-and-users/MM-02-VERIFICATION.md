---
phase: MM-02-auth-and-users
verified: 2026-11-05T07:30:00Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - .planning/phases/MM-02-auth-and-users/MM-02-01-PLAN.md
  - .planning/phases/MM-02-auth-and-users/MM-02-01-SUMMARY.md
  - starter/auth.js
  - starter/server.js
covered_digest: "v4:sha256:e28d9d976f3589012053ebc17a55321255bf261685e4f101caafb4b762bb5e62"
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
| 6 | Technician cannot create users or delete machines | ✓ VERIFIED | smoke test: 403 on both |
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

Automated: `starter/scripts/smoke-test.js` (45 checks) and
`starter/scripts/audit-offline.js` for phase 6.

No human verification outstanding for this phase.

## Overall Verdict

PASSED — every must-have has automated evidence.
