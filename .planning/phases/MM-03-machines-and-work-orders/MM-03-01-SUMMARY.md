---
phase: MM-03-machines-and-work-orders
plan: 1
subsystem: crud
tags: [node, sqlite, vanilla-js, offline]
provides:
  - Machine CRUD with retire/restore and admin-only delete
  - Work orders with open -> in_progress -> done and closed_at
  - Constraint failures return readable 400s instead of 500s with SQL text
affects: [Machines & work orders]
actuals:
  tokens: 0
  tasks: 4
  commits: 0
tech-stack:
  added: [node:sqlite, node:http, node:crypto]
  patterns: [single-table-router, ensureColumn-migrations, transactional-consume]
key-files:
  created: []
  modified: [server.js, public/index.html, public/app.js]
key-decisions:
- "Status is a CHECK constraint plus a single NEXT_STATUS map in the UI"
duration: 1 session
completed: 2026-11-05
status: complete
---

# Phase 3: Machines & work orders Summary

**Delivered, and verified by the smoke test rather than asserted.**

## Accomplishments
- Machine CRUD with retire/restore and admin-only delete
- Work orders with open -> in_progress -> done and closed_at
- Constraint failures return readable 400s instead of 500s with SQL text

## Decisions & Deviations
- Postgres-style constraint names differ in SQLite; matched on message prefixes

## Files Created/Modified
- `starter/server.js`
- `starter/public/index.html`
- `starter/public/app.js`

## Verification
Covered by `starter/scripts/smoke-test.js`. Full suite: **45 passed, 0 failed**.

## Next Phase Readiness
Ready for phase 4.
