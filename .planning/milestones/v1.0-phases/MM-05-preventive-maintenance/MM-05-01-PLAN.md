---
phase: 5
plan: 1
name: Preventive maintenance
status: complete
requirements: []
must_haves:
  - Schedule persists across restart
  - Overdue schedule appears first with days_left < 0
  - next_due equals today + interval_days
---

# Plan 5-01: Preventive maintenance

Each task below was implemented and is covered by an assertion in
`starter/scripts/smoke-test.js` (45 checks) and, for phase 6, in
`starter/scripts/audit-offline.js`.

### Task 1: pm_schedule table with interval_days and next_due

**Files:** `starter/db.js`

**Acceptance:** Schedule persists across restart

**Status:** complete

### Task 2: Due Soon window query with overdue ordering

**Files:** `starter/server.js`

**Acceptance:** Overdue schedule appears first with days_left < 0

**Status:** complete

### Task 3: Mark done rolls next_due forward exactly interval_days

**Files:** `starter/server.js`

**Acceptance:** next_due equals today + interval_days

**Status:** complete

## Verification

```
node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js
-> 45 passed, 0 failed
```
