# Roadmap: Machine Maintenance — Lean Rebuild

## Overview

Ship a four-feature maintenance app on a stack a beginner can read end to end. The scaffold in `starter/` already has the schema, the auth primitives and the page shell; the phases below turn it into something verified rather than merely written: prove persistence under crash, lock down auth, complete the CRUD surfaces, then prove it runs on a clean offline Windows machine.

## v1.0 — Lean core, offline, on Windows

**Status:** Closed — 5 verified, 1 awaiting Windows UAT (see `.planning/phases/MM-06-windows-and-offline/MM-06-UAT.md`)
**Goal:** A four-feature maintenance app a beginner can read end to end, running offline on Windows.

### Phases

- [x] **Phase 1: Foundation & persistence proof** — Make the database layer trustworthy and prove it survives restart and `kill -9` (completed 2026-11-05)
- [x] **Phase 2: Auth & users** — Real login, per-install secret, revocation, admin-only user creation (completed 2026-11-05)
- [x] **Phase 3: Machines & work orders** — Complete the two CRUD screens and their validation (completed 2026-11-05)
- [x] **Phase 4: Spare parts** — Stock levels and transactional consumption on a job (completed 2026-11-05)
- [x] **Phase 5: Preventive maintenance** — Recurring schedules, due-soon view, roll-forward on done (completed 2026-11-05)
- [~] **Phase 6: Windows portability & offline proof** — `.bat` launcher, portable copy test, zero external requests

## Phase Details

### Phase 1: Foundation & persistence proof
**Goal**: The database layer is the thing everything else depends on; prove it before building on it.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01, REQ-10, REQ-11
**Success Criteria** (what must be TRUE):
  1. Creating a record and killing the server (`kill -9` / Task Manager) leaves the record intact after restart
  2. Viewing pages does not modify the database file (mtime unchanged on GET-only traffic)
  3. A corrupted `.db` fails with a clear message and the app refuses to start rather than silently recreating an empty database
  4. Backup produces a dated file that opens with a valid schema

**Plans**:
- [x] 01-01: Review `starter/db.js` against these criteria; add startup integrity check and clear failure message
- [x] 01-02: Write `starter/scripts/smoke-test.js` — starts server, exercises each endpoint, kills, restarts, re-checks
- [x] 01-03: Add `.gitignore` for `data/` and document backup/restore in `starter/README.md`

### Phase 2: Auth & users
**Goal**: Nobody gets in without a correct password, and signing out actually signs out.
**Depends on**: Phase 1
**Requirements**: REQ-02, REQ-03
**Success Criteria** (what must be TRUE):
  1. First run prints a one-time admin password; restarting does not reprint or reseed
  2. Forged cookie signed with a different secret is rejected (verify with a script)
  3. `POST /api/logout` invalidates the cookie server-side, and it is rejected on next request
  4. There is no public registration endpoint or form anywhere in the codebase
  5. Suspended/deleted users cannot authenticate

**Plans**:
- [x] 02-01: Harden `starter/auth.js` — constant-time compares, token `sub` re-checked against the user table on each request
- [x] 02-02: Admin user management endpoint + minimal UI (list, add, disable)
- [x] 02-03: Auth test script covering the five criteria

### Phase 3: Machines & work orders
**Goal**: The two screens a workshop actually uses every day.
**Depends on**: Phase 2
**Requirements**: REQ-04, REQ-05
**Success Criteria** (what must be TRUE):
  1. Add, edit, retire a machine from the UI; list reflects it immediately
  2. Create a work order against a machine; the machine's name appears in the list
  3. Creating a work order with a bogus machine id returns a readable error, not a 500 or an orphan row
  4. Only admins can delete a machine

**Plans**:
- [x] 03-01: Finish machine edit/retire UI and server-side validation
- [x] 03-02: Work-order status transitions with `closed_at` handling
- [x] 03-03: Input validation pass: every endpoint returns 400 with a message on bad input

### Phase 4: Spare parts
**Goal**: Know what is in the cupboard and what a job consumed.
**Depends on**: Phase 3
**Requirements**: REQ-06
**Success Criteria** (what must be TRUE):
  1. Add a part with stock and price; list shows it
  2. Using a part on a work order decrements stock by the quantity used
  3. Using more than available is refused with a clear message (no negative stock)
  4. The link and the stock change are atomic (simulate a failure mid-way, confirm rollback)

**Plans**:
- [x] 04-01: Stock guards and transactional consumption
- [x] 04-02: "Parts used on this job" view + low-stock indicator

### Phase 5: Preventive maintenance
**Goal**: The feature the reviewed repo lacked — real recurring maintenance with due dates.
**Depends on**: Phase 4
**Requirements**: REQ-07
**Success Criteria** (what must be TRUE):
  1. Create a schedule: machine + task + interval in days + first due date
  2. "Due soon" with a selectable window lists only schedules inside it, overdue first
  3. "Mark done" sets `last_done` to today and `next_due` exactly `interval_days` later
  4. Changing the interval affects the *next* calculation, not history
  5. Schedules survive a restart and are visible to all signed-in users

**Plans**:
- [x] 05-01: Date arithmetic and overdue/due-soon queries, including leap-month edge cases
- [x] 05-02: Due-soon dashboard as the landing page after login
- [x] 05-03: Optional daily digest file (`data/due-soon.txt`) for a Windows scheduled task

### Phase 6: Windows portability & offline proof
**Goal**: Prove the claims in `starter/README.md` on a clean machine — this is where the reviewed repo failed.
**Depends on**: Phase 5
**Requirements**: REQ-08, REQ-09, REQ-11
**Success Criteria** (what must be TRUE):
  1. `start.bat` launches the app and opens the browser on a clean Windows machine with only Node installed
  2. No request leaves the machine: Network tab shows only `localhost`
  3. `grep -r "https\?://"` over the app finds no runtime URLs (comments and docs excluded)
  4. Copying the folder to a second machine preserves all data (database included)
  5. `starter/README.md` has a worked "add a field" example that a beginner can follow without reading other files

**Plans**:
- [x] 06-01: `start.bat` + `backup.bat` + portable-folder layout
- [x] 06-02: Offline audit script (`npm run audit:offline` equivalent, no npm needed — a Node script)
- [x] 06-03: Beginner README with the modification recipe and troubleshooting section
