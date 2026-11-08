# Project Milestones: Machine Maintenance (Lean Rebuild)

## v4.0 Stage correction and machine state (Shipped: 2026-11-05)

- A spacious, responsive stage editor with a current-state red/green switch, multiple
  spare parts and editable actual costs defaulted from the catalog.
- Latest explicit state reports win across jobs; retirement remains separate.
- Admin-only correction/deletion of the latest stage, with transactional stock and cost
  reconciliation, photo cleanup warnings and correctly rebased reviewed hours.
- 635 smoke checks passed; migration, failure handling, offline audit and real Chromium
  flows verified. Scope and details: `milestones/v4.0-WORK-ORDER-MILESTONE.md`.

## v3.0 The record (Shipped: 2026-11-06)

**Phases completed:** 3 phases, 3 plans

**Key accomplishments:**
- `closed_at` had been stored since v1.0 and never shown: a machine now has a history, open
  jobs included, and the workshop has a History screen of finished work with a date range
- One search box per list, composing with every filter, with LIKE wildcards escaped so a
  search for "50%" finds a percent sign instead of everything
- Every WHERE clause moved into `filters.js`, so each screen and its CSV export are the
  same query with a different output — proven by a mutation that made the export ignore
  the search while the screen obeyed it
- A job now records labour hours and carries a cost: hours at one configured rate plus the
  parts it consumed, computed once on the server
- A Report screen adds a month up — jobs, hours, parts, labour, total, and the machines
  that took the most work — with its own export
- Two vacuous assertions were found and repaired: a dialog count hard-coded to 5, and a
  form check whose pattern could never match the markup it was guarding

## v2.0 v2.0 (Shipped: 2026-11-05)

**Phases completed:** 3 phases, 6 plans, 17 tasks

**Key accomplishments:**
- A collapsible sidebar rendered from the same PAGES array, in its own module
- Role filtering reuses the existing flag, and five structural checks prove no screen moved
- One /api/dashboard returning four counts, capped lists, and the screen each owns
- Four cards on the landing page, each with a count, its items, and a way through
- Every screen opens with its name, purpose and action; every create form is behind a button
- Lists read as records, empty states are sentences, deletes name what they destroy

---

## v1.1 v1.1 (Shipped: 2026-11-05)

**Phases completed:** 4 phases, 7 plans, 11 tasks

**Key accomplishments:**
- Closed the one-way ratchet on stock: a part can now be restocked, corrected and deleted, and deleting one that a job consumed explains which job instead of leaking a foreign-key error.
- Each part carries its own reorder level, migrated onto existing databases with a default of 5 so no part silently changed meaning on upgrade.
- A work order now has an owner: assign, reassign and unassign, with the owner's name resolved in the list even after that person is disabled, without handing technicians the staff directory.
- Title, priority, owner and notes are editable after creation, while the technician boundary that v1.0 established is re-asserted in the same test block.
- A completion date is stored, validated, or refused; req.body was assigned at the source
- Work orders and parts export as RFC 4180 CSV that opens in Excel and matches the screen
- Failed logins were throttled per source, then the throttle was removed by decision in favour of recording failures; see the v1.1 audit amendment

---

Entries in reverse chronological order — newest first.

## v1.0 Lean core, offline, on Windows (Shipped: 2026-11-05)

**Delivered:** A four-feature maintenance app (machines, work orders, spare parts, recurring
preventive maintenance) in ~1,040 lines of plain JavaScript with zero dependencies, replacing
`Ilop08/SIAI` after the review in `.planning/milestones/v1.0-CODE-REVIEW.md`.

**Phases completed:** 6 phases, 6 plans, 22 tasks — all verified. Phase 6 verified on real
Windows 11 (Node v26.3.0) by the local agent's UAT.

**Key accomplishments:**
- Replaced sql.js's whole-file rewrite-per-request with `node:sqlite` in WAL mode, so a read never touches the disk and a write commits atomically — proven by a `SIGKILL` restart test.
- Closed all three of the reviewed repo's security holes: a per-install signing secret replaces the hardcoded one, logout revokes server-side, and no public registration route exists at all.
- Machine and work-order CRUD with real status transitions and `closed_at`, where a bogus machine id returns a readable 400 instead of a 500 leaking SQL text.
- Parts with stock and price, consumed on a job inside one transaction so the link and the decrement happen together or not at all — over-consumption is refused, never negative.
- Real recurring maintenance where the reviewed repo generated fake dates by hashing machine IDs: `pm_schedule` with `next_due`, a due-soon window that lists overdue first, and mark-done rolling forward exactly `interval_days`.
- Windows launchers plus an offline audit that proves zero external requests, verified end to end on real Windows 11 hardware rather than asserted from Linux.
- 47 automated smoke checks including a `SIGKILL` durability test, and a beginner README with two worked modification recipes.

**Stats:**
- 24 files created/modified
- ~1,040 lines of application code, ~370 lines of test code
- 6 phases, 6 plans, 22 tasks
- 1 day from start to close

**Known verification overrides:** none. The two items acknowledged earlier (the Windows UAT
and the `human_needed` verification) were resolved rather than carried: all 5 UAT scenarios
passed on Windows 11, and the run caught a real portability bug that Linux could not see —
`smoke-test.js` shelled out to `grep ... || true`, absent from `cmd.exe` (44/45 passed,
the 45th crashed). Fixed by scanning in pure JavaScript and hardening cleanup for Windows
handle-release timing; re-verified with `PATH=/nonexistent` -> **47 passed, 0 failed**.

**Git range:** `649baa0` → `4cc4c10`

**Windows evidence:** `.planning/milestones/v1.0-WINDOWS-UAT-FINDINGS.md` (Windows 11, Node v26.3.0, 5/5 scenarios)

**What's next:** v1.1 — low-stock alerts, per-machine work-order history, CSV export.

---
