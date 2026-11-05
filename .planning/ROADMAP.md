# Roadmap: Machine Maintenance — Lean Rebuild

## Milestones

- ✅ **v1.0 Lean core, offline, on Windows** — Phases 1–6 (shipped 2026-11-05)
- 🚧 **v1.1 Operable** — Phases 7–10 (in progress)

## Phases

<details>
<summary>✅ v1.0 Lean core, offline, on Windows (Phases 1–6) — SHIPPED 2026-11-05</summary>

**Goal:** A four-feature maintenance app a beginner can read end to end, running offline on Windows.

- [x] **Phase 1: Foundation & persistence proof** — Make the database layer trustworthy and prove it survives restart and `kill -9` (completed 2026-11-05)
- [x] **Phase 2: Auth & users** — Real login, per-install secret, revocation, admin-only user creation (completed 2026-11-05)
- [x] **Phase 3: Machines & work orders** — Complete the two CRUD screens and their validation (completed 2026-11-05)
- [x] **Phase 4: Spare parts** — Stock levels and transactional consumption on a job (completed 2026-11-05)
- [x] **Phase 5: Preventive maintenance** — Recurring schedules, due-soon view, roll-forward on done (completed 2026-11-05)
- [x] **Phase 6: Windows portability & offline proof** — `.bat` launcher, portable copy test, zero external requests (completed 2026-11-05)

Full phase detail, goals, success criteria and plans: `.planning/milestones/v1.0-ROADMAP.md`.
Shipped record and accomplishments: `.planning/MILESTONES.md`.

</details>

## v1.1 — Operable

**Goal:** Complete the operational coverage of the working application v1.0 shipped — every
entity editable, stock that can go up as well as down, and work that belongs to somebody.

**Starting point:** v1.0 runs offline on Windows and is verified against real hardware. It is not
a prototype. What it lacks is breadth of operations within that working system: parts cannot be
restocked, corrected or removed; work orders cannot be assigned or edited after creation; and
`mark done` silently discards a supplied date.

### Phases

- [x] **Phase 7: Parts become maintainable** — Restock, edit, delete, and a per-part reorder level (PART-01 … PART-05) (completed 2026-11-05)
- [x] **Phase 8: Work belongs to somebody** — Assign and edit work orders without weakening the role boundary (WO-01 … WO-04) (completed 2026-11-05)
- [ ] **Phase 9: Honest dates and real exports** — Fix the silently-dropped completion date; export work orders and parts to CSV (PM-01 … PM-03, CSV-01 … CSV-04)
- [ ] **Phase 10: Login hardening** — Throttle repeated failed logins, with a block that expires on its own (AUTH-01 … AUTH-03)

## Phase Details

### Phase 7: Parts become maintainable
**Goal**: `parts.qty` stops being a one-way ratchet. This is the phase that makes the app usable, so it goes first.
**Depends on**: v1.0 (complete)
**Requirements**: PART-01, PART-02, PART-03, PART-04, PART-05
**Success Criteria** (what must be TRUE):
  1. A part's stock can be raised back up from the UI, and the change is visible immediately
  2. A part's name, reference, supplier and unit price can be corrected after creation
  3. Deleting an unused part works and removes it from the list
  4. Deleting a part that appears on a work order is refused with a message naming the job(s) — verified by actually attempting it, not by reading the FK declaration
  5. The low-stock badge uses each part's own reorder level; two parts with different levels show different badges at the same quantity

**Notes**: PART-04 is the trap. `work_order_parts.part_id` is declared `ON DELETE RESTRICT`, so a raw `DELETE` throws a SQLite constraint error. The route must pre-check and return a readable 400, consistent with how v1.0 handles FK errors.

**Plans**:
- [x] 07-01: `PUT /api/parts/:id` (stock + fields) and `DELETE /api/parts/:id` with the in-use guard; wire both into the Spare parts screen
- [x] 07-02: `reorder_level` column via `ensureColumn` + badge logic and the form field

### Phase 8: Work belongs to somebody
**Goal**: A work order has an owner and can be corrected after it is created.
**Depends on**: Phase 7
**Requirements**: WO-01, WO-02, WO-03, WO-04
**Success Criteria** (what must be TRUE):
  1. A work order can be assigned to a user and shows that name in the list
  2. A work order can be reassigned, and unassigned back to nobody
  3. Title, notes and priority can be edited after creation — a typo is no longer permanent
  4. Unassigning a user who is later disabled leaves the historical record readable (the row keeps a name, not a dangling id with no meaning)
  5. A technician can do all of the above but still gets 403 on user management and machine deletion

**Notes**: `db.js:105` already carries the commented example `ensureColumn('work_orders', 'assigned_to', 'INTEGER')` — the scaffold anticipated this. Criterion 4 argues for storing the assignee as a foreign key plus resolving the name on read, and *not* cascading the delete; a disabled user's name must still render.

**Plans**:
- [x] 08-01: `assigned_to` column, assignment in the work-order PATCH, join to users for display
- [x] 08-02: Edit title/notes/priority UI, with the role boundary re-asserted in the smoke suite

### Phase 9: Honest dates and real exports
**Goal**: No endpoint may silently ignore an input, and the two lists a workshop actually puts in Excel can be exported.
**Depends on**: Phase 8
**Requirements**: PM-01, PM-02, PM-03, CSV-01, CSV-02, CSV-03, CSV-04
**Success Criteria** (what must be TRUE):
  1. `POST /api/pm/:id/done` with a valid past date stores *that* date and rolls `next_due` from it
  2. A garbage date returns 400 naming the field; a future date is refused with a reason
  3. Downloading work orders produces a file Excel opens directly in columns, with a header row
  4. A work-order title containing a comma, a double quote and a newline round-trips without shifting columns
  5. The CSV contains the same rows as the filtered view that produced it

**Notes**: The root cause of PM-01 is broader than the PM handler — `req.body` is never assigned in `server.js`, so any future handler reaching for it will fail the same way. The fix should make the body available (or delete the dead `req.body?.on` read and use a parsed value), and a regression check should assert that a supplied value is *used*, not merely that the call returns 200. That distinction is exactly what v1.0 got wrong.

**Plans**:
- [ ] 09-01: Fix body handling; honour, validate and cap the completion date
- [ ] 09-02: CSV writer (quoting/escaping) + two export endpoints + download buttons that pass current filters

### Phase 10: Login hardening
**Goal**: Guessing passwords over the LAN is slow and visible.
**Depends on**: Phase 9
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. Repeated wrong passwords from one source are refused with a message stating the wait
  2. The correct password after a successful login attempt resets the counter
  3. A throttled source recovers automatically once the window elapses — no manual intervention, no permanent lockout
  4. The throttle does not exist in a form that lets an attacker lock out a known admin indefinitely

**Notes**: In-memory is acceptable at this scale and consistent with v1.0's session store, but the choice must be written down. AUTH-03 rules out a naive "lock the account" design.

**Plans**:
- [ ] 10-01: Per-source failure counter with a time window, cleared on success; smoke checks including a simulated expiry
