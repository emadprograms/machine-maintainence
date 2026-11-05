# Phase 8: Work belongs to somebody - Context

**Gathered:** 2026-11-05
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recommended answers recorded as accepted)

<domain>
## Phase Boundary

A work order has an owner and can be corrected after creation. A user can assign it to a named
person, reassign it, or unassign it; edit the title, notes and priority; and see who owns what in
the list. The v1.0 role boundary is preserved: technicians may do all of this, but still cannot
manage users or delete machines.

Out of scope: notification when work is assigned (no mail relay on the LAN), work-order comments
or attachments, and a full audit log of who changed what.

</domain>

<decisions>
## Implementation Decisions

### Storage of the assignee
- `work_orders.assigned_to INTEGER REFERENCES users(id)`, added by `ensureColumn` — the pattern
  `db.js` already documents as an example at the commented line.
- `ON DELETE SET NULL` is not expressible through `ALTER TABLE ADD COLUMN` in SQLite, so the
  delete path is handled by the app: no user deletion endpoint exists (users are disabled, never
  deleted), which means a dangling id cannot arise today. Recorded rather than pretended.
- A disabled user stays assignable-in-name: the list joins `users` without filtering on `active`,
  so history keeps rendering a real name after someone leaves. This is the WO-02/WO-04 trap named
  in the roadmap.

### What may be assigned
- Only users with `role` of either kind — both technicians and admins can own work.
- Assignment is validated against the `users` table: an unknown id returns 400 "That person does
  not exist", not a foreign-key error. Same reasoning as the part-in-use guard in phase 7.
- Unassigning is `assigned_to: null`, explicitly, not an omitted field.

### Editing
- Extend the existing `PATCH /api/work-orders/:id` rather than adding a second route: it already
  handles status, priority and notes with `??` fallbacks. Add `title` and `assigned_to`.
- `title` must be non-empty after trim when supplied.
- The status → `closed_at` behaviour stays exactly as it is.
- Editing is not restricted by role or by ownership: a workshop is a small team and any technician
  may correct any order's notes. Role restrictions exist to protect user accounts and machine
  records, not to police shared work.

### UI shape
- The work-order row gains an "Owner" column showing the assigned name or a muted "unassigned".
- Assignment is a `<select>` in the inline edit row, populated from `/api/users` for admins and
  from a new lightweight `/api/users/assignable` for technicians — technicians cannot read the
  full staff list (phase 1's bug #11), and loosening that to populate a dropdown would undo a
  fixed leak.
- Inline edit follows phase 7's pattern exactly: pencil → prefilled inputs → Save/Cancel.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PATCH /api/work-orders/:id` with `?? before.field` fallbacks — extend, don't duplicate.
- `ensureColumn()` in `db.js:100` — one line for the new column.
- `esc()`, `badge()`, inline-edit pattern and `alert(e.message)` error surfacing from phase 7.
- `stockValue()`-style validator returning `{ value } | { error }` — the shape to copy for
  `assigneeValue()`.

### Established Patterns
- List queries join to resolve display names (`equipment_name` already does this).
- Route-level role checks are a single `if (req.user.role !== 'admin') return 403`.
- Mutations return the updated row.

### Integration Points
- `starter/db.js` — `work_orders` table at line 44; `ensureColumn` block at line 101.
- `starter/server.js` — work-order routes at line 177; users routes at line 265.
- `starter/public/app.js` — `loadWork()`/`advance()` around line 120.
- `starter/public/index.html` — work-order section at line 115.
- `starter/scripts/smoke-test.js` — work-order assertions near the top of the suite.

</code_context>

<specifics>
## Specific Ideas

- `/api/users/assignable` should return only `{ id, name }` — enough for a dropdown, nothing more.
  A technician needs to pick a name, not browse email addresses.
- The smoke suite must re-assert the phase-1 guarantee that a technician gets 403 on
  `GET /api/users` *after* this phase adds a second, narrower user route. Two similar routes is
  exactly how that leak would come back.

</specifics>

<deferred>
## Deferred Ideas

- Assignment notifications / "my work" digest — no mail relay, and the due-soon page is the
  established pattern for surfacing work.
- Per-user workload view — reporting, belongs after CSV export lands.
- Work-order comments thread — a different feature from "who owns it".
- Reopening a closed order with a reason (WO history) — service history is deferred to a later
  milestone with reasons in REQUIREMENTS.md.

</deferred>
