---
phase: MM-08-work-belongs-to-somebody
plan: 2
one-liner: "Title, priority, owner and notes are editable after creation, while the technician boundary that v1.0 established is re-asserted in the same test block."
wave: 1
subsystem: crud
tags: [node, sqlite, vanilla-js, offline]
provides:
  - Editable work-order title with empty-title refusal
  - Inline edit row following the phase 7 pattern
affects: [Work orders]
actuals:
  tokens: 0
  tasks: 3
  commits: 0
tech-stack:
  added: []
  patterns: [inline-row-edit]
key-files:
  created: []
  modified: [server.js, public/app.js, public/index.html, scripts/smoke-test.js]
key-decisions:
- "Editing is not role-restricted: a small team corrects each other's notes; the role boundary protects accounts and machine records, not shared work"
duration: 1 session
completed: 2026-11-05
status: complete
---

# Phase 8 Plan 2: Editing a work order Summary

**A typo in a work order is no longer permanent.**

## Accomplishments
- `PATCH` accepts `title`; empty titles refused, partial updates cannot blank it
- Status and `closed_at` behaviour untouched, asserted explicitly
- Inline edit row with owner, priority, title and Save/Cancel

## Decisions & Deviations
- Shipped in plan 1's commit — same files, and splitting would have produced a commit that
  could not pass its own suite.

## Verification
Assertions cover: title edit persists, status unaffected by the edit, empty title 400,
notes-only edit preserves the title, and a technician can edit while still 403 on user creation
and machine deletion.
