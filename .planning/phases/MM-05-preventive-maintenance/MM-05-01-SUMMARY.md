---
phase: MM-05-preventive-maintenance
plan: 1
one-liner: "Real recurring maintenance where the reviewed repo generated fake dates by hashing machine IDs: pm_schedule with next_due, a due-soon window that lists overdue first, and mark-done rolling forward exactly interval_days."
subsystem: scheduling
tags: [node, sqlite, vanilla-js, offline]
provides:
  - pm_schedule table: task, interval_days, last_done, next_due
  - Due Soon view with a selectable window, overdue first
  - Mark done rolls next_due forward exactly interval_days
affects: [Preventive maintenance]
actuals:
  tokens: 0
  tasks: 3
  commits: 0
tech-stack:
  added: [node:sqlite, node:http, node:crypto]
  patterns: [single-table-router, ensureColumn-migrations, transactional-consume]
key-files:
  created: []
  modified: [db.js, server.js, public/app.js]
key-decisions:
- "Date arithmetic in SQL (date(?, '+' || interval_days || ' days')) not JS"
duration: 1 session
completed: 2026-11-05
status: complete
---

# Phase 5: Preventive maintenance Summary

**Delivered, and verified by the smoke test rather than asserted.**

## Accomplishments
- pm_schedule table: task, interval_days, last_done, next_due
- Due Soon view with a selectable window, overdue first
- Mark done rolls next_due forward exactly interval_days

## Decisions & Deviations
- Replaced the reviewed repo's hashDay() invention with real stored dates

## Files Created/Modified
- `starter/db.js`
- `starter/server.js`
- `starter/public/app.js`

## Verification
Covered by `starter/scripts/smoke-test.js`. Full suite: **45 passed, 0 failed**.

## Next Phase Readiness
Ready for phase 6.

## Performance
**Tasks:** 3. One plan, executed as 3 sequenced tasks, all marked complete.
