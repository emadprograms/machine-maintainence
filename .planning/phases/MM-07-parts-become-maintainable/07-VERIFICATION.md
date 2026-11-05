---
phase: MM-07-parts-become-maintainable
verified: 2026-11-05T11:35:00Z
status: passed
score: 9/9 must-haves verified
covered_files:
  - .planning/phases/MM-07-parts-become-maintainable/07-01-PLAN.md
  - .planning/phases/MM-07-parts-become-maintainable/07-01-SUMMARY.md
  - .planning/phases/MM-07-parts-become-maintainable/07-02-PLAN.md
  - .planning/phases/MM-07-parts-become-maintainable/07-02-SUMMARY.md
  - starter/db.js
  - starter/public/app.js
  - starter/public/index.html
  - starter/scripts/smoke-test.js
  - starter/server.js
covered_digest: "v4:sha256:7af3036951bb7f1a264e00a7e17ea6b01f748348ba80e5b44a5d397225bf4ae2"
behavior_unverified: 0
---

# Phase 7: Parts become maintainable Verification Report

**Phase Goal:** `parts.qty` stops being a one-way ratchet — a user can restock, correct,
delete an unused part, and see a low-stock badge driven by that part's own reorder level.
**Verified:** 2026-11-05
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Stock can be raised back up from the UI, visible immediately | ✓ VERIFIED | `PUT /api/parts/:id {"qty":40}` → 200, qty 40; live server probe returned `qty now 25`; smoke: "stock can be raised back up" |
| 2 | Name, reference, supplier and unit price are correctable after creation | ✓ VERIFIED | smoke: "part can be renamed after creation"; live probe renamed `O'Brien seal` and the apostrophe survived |
| 3 | Deleting an unused part works and it leaves the list | ✓ VERIFIED | smoke: "unused part deletes cleanly" + "deleted part disappears from the list" |
| 4 | Deleting a used part is refused naming the job, not a raw FK error | ✓ VERIFIED | live: `400 {"error":"This part was used on: Replace seal. Remove it from those jobs first."}`; smoke asserts the title is present and `FOREIGN KEY`/`constraint` are absent |
| 5 | The badge uses each part's own reorder level | ✓ VERIFIED | smoke: "two parts at the same qty carry different levels" — same qty, different `reorder_level` |
| 6 | A part at exactly its reorder level is flagged | ✓ VERIFIED | smoke: "reorder level is inclusive at the boundary" asserts `qty <= level` is true for one part and false for the other |
| 7 | Existing database files migrate without data loss | ✓ VERIFIED | hand-built pre-phase-7 DB: `migrated: added parts.reorder_level`, existing row kept `qty: 7`, gained `reorder_level: 5` |
| 8 | Invalid input is rejected, never coerced | ✓ VERIFIED | negative, non-numeric, fractional and negative-price cases all 400; malformed JSON 400 with no TypeError |
| 9 | Deleting a part never leaves a dangling `work_order_parts` row | ✓ VERIFIED | the guard runs before the delete; `ON DELETE RESTRICT` remains as the backstop |

## Required Artifacts

| Artifact | Expected | Status |
|---|---|---|
| `PUT /api/parts/:id` | restock + correction route | ✓ `server.js:221` |
| `DELETE /api/parts/:id` | guarded delete | ✓ `server.js:248` |
| `parts.reorder_level` | column + migration | ✓ `db.js:69`, `db.js:106` |
| `stockCell()` | single badge rule | ✓ `public/app.js:161` |
| Inline edit row | prefilled inputs + Save/Cancel | ✓ `public/app.js:170` |

## Anti-Patterns Found

| Pattern | Result |
|---|---|
| Clamping invalid numbers to a default | absent — validators reject |
| Relying on the FK error text | absent — pre-check builds the message |
| Handler-specific body null guards | absent — one typed error in `readBody` |
| Raw name interpolated into `onclick` | removed before commit (IN-7-01) |
| A test that passes with or without its fix | absent — proven by reintroducing the bug |

## Behavioral Verification

Automated: `starter/scripts/smoke-test.js` — **67 passed, 0 failed** under `PATH=/nonexistent`.
Offline audit: `OFFLINE-SAFE`.

Live probes recorded during execution: restock, rename-with-apostrophe, in-use delete refusal,
malformed-JSON rejection, and an old-schema migration with a live row.

### Test-the-test check

The two malformed-JSON assertions were run against a deliberately reintroduced bug:
`FAIL malformed JSON does not leak a TypeError — "Cannot read properties of null (reading 'name')"`,
then restored to green. The assertion is therefore known to detect its target.

## Known Limitation

Manual-only: the inline edit row's layout under a narrow window is not asserted by any
automated check. Recorded in `07-VALIDATION.md`.

## Overall Verdict

PASSED — every must-have has automated evidence, and the one behavior without an automated
check is layout-only and named.

## Re-verification after phase 8

Phase 8 modified all five files this report covers (`server.js`, `db.js`, `public/app.js`,
`public/index.html`, `scripts/smoke-test.js`), so the digest went stale. Re-checked rather than
re-stamped:

- The phase 7 assertions all still exist and pass — the suite is now **85 checks, 0 failed**.
- `PUT`/`DELETE /api/parts/:id` are untouched by phase 8's work-order changes.
- Phase 8's `assigneeValue()` follows the same `{value}|{error}` shape `stockValue()` established,
  so the two validators did not diverge.
- Phase 8 changed `PATCH /api/work-orders/:id`; phase 7 does not touch work-order editing, so no
  phase 7 behaviour is affected.

Verdict unchanged: passed.

---

## Re-verification after phase 9

Phase 9 changed all five files this phase covers (`server.js`, `db.js`,
`public/app.js`, `public/index.html`, `scripts/smoke-test.js`), so the report went
stale by design rather than by accident. Re-verified rather than re-stamped.

**What phase 9 changed underneath this phase:** `readBody()` now caches its
promise and `route()` assigns `req.body` for methods that carry a body; the
parts list route reads `?low=`; the CSV export reuses the parts WHERE-builder;
`closed_at` uses a new `nowStamp()`.

**Re-probed on a fresh database (:3671):**

| Must-have | Result |
|---|---|
| `reorder_level` is stored and editable | `PUT` → 1 |
| A single-field `PUT` does not blank other fields | `{"qty":50}` left `name` = Bearing |
| Negative and non-numeric quantities refused | `-1` → 400, `"abc"` → 400 |
| `id` cannot be rewritten by a body | sent `{"id":99}` → row still 1 |
| Low-stock filter | 1 row at/below reorder; 0 after qty raised above it |
| Delete | 200 |

**Suite:** 118 checks, 0 failures, unchanged for this phase's assertions. The
low-stock filter is now additionally covered by a CSV export assertion.

**One probe error worth recording:** the first re-check used `PATCH
/api/parts/1` and got 404. The route is `PUT`, as planned and as the UI sends.
The 404 was the probe's mistake, not a regression — no code changed.
