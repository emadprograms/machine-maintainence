---
phase: MM-08-work-belongs-to-somebody
plan: 1
one-liner: "A work order now has an owner: assign, reassign and unassign, with the owner's name resolved in the list even after that person is disabled, without handing technicians the staff directory."
wave: 1
subsystem: crud
tags: [node, sqlite, vanilla-js, offline]
provides:
  - work_orders.assigned_to with ensureColumn migration
  - GET /api/users/assignable — id and name only, any signed-in user
  - assignee_name resolved in the work-order list, disabled owners included
affects: [Work orders, Users]
actuals:
  tokens: 0
  tasks: 6
  commits: 1
tech-stack:
  added: []
  patterns: [narrow-public-route, validated-assignee, left-join-without-active-filter]
key-files:
  created: []
  modified: [db.js, server.js, public/app.js, public/index.html, scripts/smoke-test.js]
key-decisions:
- "No FK clause on assigned_to: SQLite cannot ADD COLUMN with REFERENCES, and users are never deleted, only disabled"
- "A second, narrower users route rather than relaxing the admin-only one"
- "The assignable payload returns exactly id and name, asserted by key-shape and by absence of '@'"
duration: 1 session
completed: 2026-11-05
status: complete
---

# Phase 8 Plan 1: Assignment and ownership Summary

**Someone owns the work now, and the staff directory stayed shut.**

## Accomplishments
- `assigned_to` column migrated onto existing databases with the row intact
- Assign, reassign, unassign; unknown id is a readable 400, not an FK error
- The list resolves `assignee_name` and keeps rendering a disabled owner's name
- `GET /api/users/assignable` for dropdowns — names only, no email, no role

## Decisions & Deviations
- Added a key-shape assertion (`id,name` exactly) rather than only checking for emails: an email
  check alone would pass if someone added `role` to the payload.

## Verification
`smoke-test.js`: 85 passed, 0 failed. Legacy-schema migration proven against a hand-built
pre-phase-8 file: `migrated: added work_orders.assigned_to`, legacy row kept with `assigned_to: null`.
Live probe: admin assigns to a technician, list shows "Sam T", technician reads
`[{id,name}]` but gets 403 from `/api/users`.
