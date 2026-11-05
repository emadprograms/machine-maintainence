---
phase: MM-01-foundation
plan: 1
subsystem: persistence
tags: [node, sqlite, vanilla-js, offline]
provides:
  - Replaced sql.js's whole-file rewrite with node:sqlite in WAL mode
  - Added ensureColumn() migrations and VACUUM INTO backup
  - Added .gitignore so data/ (live DB + signing key) is never committed
affects: [Foundation & persistence proof]
actuals:
  tokens: 0
  tasks: 3
  commits: 0
tech-stack:
  added: [node:sqlite, node:http, node:crypto]
  patterns: [single-table-router, ensureColumn-migrations, transactional-consume]
key-files:
  created: []
  modified: [db.js, server.js, .gitignore]
key-decisions:
- "SQLite in WAL mode instead of export/writeFileSync per request"
- "Backups via VACUUM INTO rather than a file copy of an open database"
duration: 1 session
completed: 2026-11-05
status: complete
---

# Phase 1: Foundation & persistence proof Summary

**Delivered, and verified by the smoke test rather than asserted.**

## Accomplishments
- Replaced sql.js's whole-file rewrite with node:sqlite in WAL mode
- Added ensureColumn() migrations and VACUUM INTO backup
- Added .gitignore so data/ (live DB + signing key) is never committed

## Decisions & Deviations
- server.js has no separate save path — SQLite commits atomically per transaction
- Backup endpoint writes data/backup-YYYY-MM-DD-HH-MM-SS.db

## Files Created/Modified
- `starter/db.js`
- `starter/server.js`
- `starter/.gitignore`

## Verification
Covered by `starter/scripts/smoke-test.js`. Full suite: **45 passed, 0 failed**.

## Next Phase Readiness
Ready for phase 2.
