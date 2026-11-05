---
phase: MM-08-work-belongs-to-somebody
verified: 2026-11-05T12:05:00Z
status: passed
score: 9/9 must-haves verified
covered_files:
  - .planning/phases/MM-08-work-belongs-to-somebody/08-01-PLAN.md
  - .planning/phases/MM-08-work-belongs-to-somebody/08-01-SUMMARY.md
  - .planning/phases/MM-08-work-belongs-to-somebody/08-02-PLAN.md
  - .planning/phases/MM-08-work-belongs-to-somebody/08-02-SUMMARY.md
  - starter/db.js
  - starter/public/app.js
  - starter/public/index.html
  - starter/scripts/smoke-test.js
  - starter/server.js
covered_digest: "v4:sha256:5cd171a32dd57aa32c97d8b4d04c3eed48171fe675318748d3a25214a77f451d"
behavior_unverified: 0
---

# Phase 8: Work belongs to somebody Verification Report

**Phase Goal:** A work order has an owner and can be corrected after creation, without
weakening the role boundary v1.0 established.
**Verified:** 2026-11-05
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A work order can be assigned to a named user | ✓ VERIFIED | smoke "work order can be assigned"; live probe assigned to "Sam T" |
| 2 | It can be reassigned and unassigned | ✓ VERIFIED | smoke "can be reassigned" (→ Admin), "can be unassigned" (→ null) |
| 3 | The owner's name appears in the list | ✓ VERIFIED | smoke "the list resolves the owner name" → 'Tech One'; live → 'Sam T' |
| 4 | A disabled owner's name still renders | ✓ VERIFIED | smoke "a disabled owner is still named on the job" — the order was assigned *after* the user was disabled |
| 5 | Title, notes and priority are editable | ✓ VERIFIED | smoke "title can be edited", "a notes-only edit does not blank the title" |
| 6 | Editing does not disturb status or the closed timestamp | ✓ VERIFIED | smoke "editing the title leaves the status alone", comparing against the pre-edit value |
| 7 | Invalid assignment is a readable 400 | ✓ VERIFIED | smoke "readable 400" + "does not leak SQL" |
| 8 | A technician can do all of the above | ✓ VERIFIED | smoke "technician can edit a work order" → 200 |
| 9 | The role boundary is unchanged | ✓ VERIFIED | smoke: technician 403 on user creation and machine deletion; live: 403 on `GET /api/users` |

## Required Artifacts

| Artifact | Expected | Status |
|---|---|---|
| `work_orders.assigned_to` | column + migration | ✓ `db.js` table + `ensureColumn` |
| `GET /api/users/assignable` | id + name for any signed-in user | ✓ `server.js` |
| `assignee_name` | resolved owner in the list | ✓ LEFT JOIN, no `active` filter |
| Inline edit row | prefilled inputs, owner + priority selects | ✓ `public/app.js` |

## Anti-Patterns Found

| Pattern | Result |
|---|---|
| Widening `GET /api/users` to populate a dropdown | absent — a separate narrowed route instead |
| `REFERENCES users(id)` added by `ALTER TABLE` | absent — impossible in SQLite; app validates and users are never deleted |
| Owner resolved by client-side lookup | absent — resolved in SQL so a stale id cannot show a wrong name |
| A test asserting a hardcoded fixture value | found and fixed — see below |

## Behavioral Verification

Automated: **85 passed, 0 failed** under `PATH=/nonexistent`. Offline audit `OFFLINE-SAFE`.
Legacy-schema migration proven against a hand-built pre-phase-8 database with a live work-order row.

### One assertion was corrected, not a bug fixed

"editing the title leaves the status alone" initially hardcoded `'open'` and failed with
`status=done` — the fixture had been moved to `done` in phase 3. The assertion now captures the
status before the edit and compares. This is recorded because a failing test that turns out to be
a bad assertion is worth distinguishing from a real defect.

### Leak regression guard

The phase-1 bug (#11, technician could read the staff list) is guarded here by four assertions:
the narrow route works for a technician, exposes exactly `id,name`, contains no `@`, and the full
route still returns 403.

## Overall Verdict

PASSED — every must-have has automated evidence.

---

## Re-verification after phase 9

Phase 9 changed all five files this phase covers. Re-verified rather than
re-stamped.

**What phase 9 changed underneath this phase:** the work-order list route now
applies a `?status=` filter through a shared WHERE-builder that the CSV export
also uses; `closed_at` uses `nowStamp()`; `route()` now assigns `req.body`.

**Re-probed on a fresh database (:3671):**

| Must-have | Result |
|---|---|
| Assignment on create | `assigned_to: 2` |
| Owner name resolved in the list | `assignee_name` = 'Sam T' |
| Unassign | `assigned_to: null` |
| Invalid owner is a readable 400 | `That person does not exist` |
| Technician blocked from the staff directory | `/api/users` → 403 |
| Technician's assignable list is narrow | keys exactly `['id','name']` |
| Technician may edit a work order | `PATCH` → 200 |

**Suite:** 118 checks, 0 failures. The shared filter builder introduced by phase
9 does not drop the `LEFT JOIN` that keeps a departed technician's name on the
job — asserted by "a disabled owner is still named on the job".

---

## Re-verification after phase 10

Phase 10 changed `server.js` (login route), `public/app.js` (countdown) and
`scripts/smoke-test.js`. Re-probed rather than re-stamped.

**Re-probed on a fresh database (:3688), after phase 10 was in place:**

| Must-have | Result |
|---|---|
| Owner resolved in the list | `assignee_name` = 'Sam T' |
| Invalid owner is a readable 400 | `That person does not exist` |
| Technician blocked from the staff directory | `/api/users` → 403 |
| Technician's assignable list stays narrow | keys exactly `['id','name']` |
| Technician may still edit a work order | `PATCH` → 200 |

The login throttle does not interfere: the technician signs in as that phase's
own assertion does, and the phase-9/10 tests share one source without crossing
the threshold because each successful login clears it.

**Suite:** 145 checks, 0 failures.
