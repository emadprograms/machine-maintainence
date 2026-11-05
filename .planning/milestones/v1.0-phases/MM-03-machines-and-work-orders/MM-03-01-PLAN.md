---
phase: 3
plan: 1
name: Machines & work orders
status: complete
requirements: []
must_haves:
  - Retire sets status; technician delete is 403
  - done sets closed_at; invalid status is 400
  - Bogus equipment_id returns 400 with a message, not a 500
---

# Plan 3-01: Machines & work orders

Each task below was implemented and is covered by an assertion in
`starter/scripts/smoke-test.js` (45 checks) and, for phase 6, in
`starter/scripts/audit-offline.js`.

### Task 1: Machine CRUD: create, edit, retire, admin-only delete

**Files:** `starter/server.js`, `starter/public/app.js`

**Acceptance:** Retire sets status; technician delete is 403

**Status:** complete

### Task 2: Work order lifecycle open -> in_progress -> done with closed_at

**Files:** `starter/server.js`

**Acceptance:** done sets closed_at; invalid status is 400

**Status:** complete

### Task 3: Readable validation errors for constraint violations and bad input

**Files:** `starter/server.js`

**Acceptance:** Bogus equipment_id returns 400 with a message, not a 500

**Status:** complete

## Verification

```
node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js
-> 45 passed, 0 failed
```
