---
phase: MM-07-parts-become-maintainable
plan: 1
one-liner: "Closed the one-way ratchet on stock: a part can now be restocked, corrected and deleted, and deleting one that a job consumed explains which job instead of leaking a foreign-key error."
wave: 1
subsystem: crud
tags: [node, sqlite, vanilla-js, offline]
provides:
  - PUT /api/parts/:id — restock and correct, with per-field fallbacks
  - DELETE /api/parts/:id — in-use guard naming the work orders
  - stockValue/priceValue validators that reject rather than clamp
  - readBody rejecting malformed JSON centrally instead of each handler guarding
affects: [Spare parts, All API routes]
actuals:
  tokens: 0
  tasks: 4
  commits: 1
tech-stack:
  added: []
  patterns: [per-field-fallback-update, typed-body-error, reject-not-clamp]
key-files:
  created: []
  modified: [server.js, db.js, public/app.js, public/index.html, scripts/smoke-test.js]
key-decisions:
- "Stock is set by absolute value, not a delta: the form prefills the current number so the user edits what they can see"
- "In-use delete is a pre-check, not a constraint catch, because the message needs the job titles anyway"
- "Malformed JSON is fixed once in readBody rather than null-guarded in 11 handlers"
duration: 1 session
completed: 2026-11-05
status: complete
---

# Phase 7 Plan 1: Parts become maintainable Summary

**Restock, correct and delete now work; the ratchet is closed.**

## Accomplishments
- `PUT /api/parts/:id` restores stock and corrects name, reference, supplier, price and reorder level
- `DELETE /api/parts/:id` refuses with the work-order titles when the part was consumed
- Validators reject negative, fractional and absurd values instead of clamping them
- `readBody` now rejects malformed JSON; `route()` answers with one readable 400 for every route
- 20 new smoke assertions (47 → 67), two of them proven to fail when the bug they guard is put back

## Decisions & Deviations
- Deviated from the plan's Task 3 by moving the badge rule into `stockCell()` — the plan had the
  threshold inline in the row template, which made the UI rule and the tests two separate facts.
- Added a `rawBody` option to the test client, which the plan did not call for: without it a
  malformed-JSON assertion could not be written at all, since the client stringifies everything.
- `reorder_level` carries no SQL CHECK constraint (see IN-7-02); the API is the only writer and it
  validates. Adding one would need a table rebuild.

## Verification
`starter/scripts/smoke-test.js` — 67 passed, 0 failed under `PATH=/nonexistent`.
Migration proven against a hand-built pre-phase-7 database file with a live row, and against a
second start (no repeat migration).
