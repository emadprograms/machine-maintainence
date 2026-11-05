---
phase: 1
plan: 1
name: Foundation & persistence proof
status: complete
requirements: []
must_haves:
  - Database file created on first run; tables exist; second run is a no-op
  - Adding an ensureColumn call migrates an existing file; logged to console
  - Backup returns a path to a non-empty .db file
  - mtime unchanged after 5 GET requests
---

# Plan 1-01: Foundation & persistence proof

Each task below was implemented and is covered by an assertion in
`starter/scripts/smoke-test.js` (45 checks) and, for phase 6, in
`starter/scripts/audit-offline.js`.

### Task 1: Open a database file with node:sqlite in WAL mode, create tables idempotently

**Files:** `starter/db.js`

**Acceptance:** Database file created on first run; tables exist; second run is a no-op

**Status:** complete

### Task 2: Add ensureColumn() so a field can be added without losing data

**Files:** `starter/db.js`

**Acceptance:** Adding an ensureColumn call migrates an existing file; logged to console

**Status:** complete

### Task 3: Add VACUUM INTO backup and a POST /api/backup route

**Files:** `starter/db.js`, `starter/server.js`

**Acceptance:** Backup returns a path to a non-empty .db file

**Status:** complete

### Task 4: Prove reads do not write: assert mtime stability across GETs

**Files:** `starter/scripts/smoke-test.js`

**Acceptance:** mtime unchanged after 5 GET requests

**Status:** complete

## Verification

```
node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js
-> 45 passed, 0 failed
```
