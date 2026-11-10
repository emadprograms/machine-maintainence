---
phase: MM-04-spare-parts
plan: 1
one-liner: "Parts with stock and price, consumed on a job inside one transaction so the link and the decrement happen together or not at all — over-consumption is refused, never negative."
subsystem: crud
tags: [node, sqlite, vanilla-js, offline]
provides:
  - Parts with stock and price; low-stock and out-of-stock badges
  - Consumption checks stock, decrements and links in one transaction
  - Over-consumption refused with the available quantity in the message
affects: [Spare parts]
actuals:
  tokens: 0
  tasks: 3
  commits: 0
tech-stack:
  added: [node:sqlite, node:http, node:crypto]
  patterns: [single-table-router, ensureColumn-migrations, transactional-consume]
key-files:
  created: []
  modified: [server.js, db.js, public/app.js]
key-decisions:
- "work_order_parts is a many-to-many table with a composite primary key"
duration: 1 session
completed: 2026-11-05
status: complete
---

# Phase 4: Spare parts Summary

**Delivered, and verified by the smoke test rather than asserted.**

## Accomplishments
- Parts with stock and price; low-stock and out-of-stock badges
- Consumption checks stock, decrements and links in one transaction
- Over-consumption refused with the available quantity in the message

## Decisions & Deviations
- Second use of the same part raised UNIQUE instead of a stock error
- Fixed with an explicit stock check plus ON CONFLICT DO UPDATE

## Files Created/Modified
- `starter/server.js`
- `starter/db.js`
- `starter/public/app.js`

## Verification
Covered by `starter/scripts/smoke-test.js`. Full suite: **45 passed, 0 failed**.

## Next Phase Readiness
Ready for phase 5.

## Performance
**Tasks:** 3. One plan, executed as 3 sequenced tasks, all marked complete.
