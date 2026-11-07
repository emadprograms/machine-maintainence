# Phase 7: Parts become maintainable - Context

**Gathered:** 2026-11-05
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recommended answers recorded as accepted)

<domain>
## Phase Boundary

`parts.qty` stops being a one-way ratchet. A user can restock a part, correct its name,
reference, supplier and unit price, delete it when it was never used, and see a low-stock
badge driven by that part's own reorder level. Deleting a part that has been consumed on a job
is refused with a message naming the jobs.

Out of scope: reporting on stock (CSV is phase 9), low-stock alerting, purchase orders, and
per-location stock. This phase only makes the existing parts record maintainable.

</domain>

<decisions>
## Implementation Decisions

### Restock semantics
- Stock is set by absolute value via `PUT /api/parts/:id` (`{"qty": 50}` means "there are 50"), not by a relative delta. The form shows the current value prefilled, so the user edits a number they can see.
- `qty` is coerced and validated as a non-negative integer. A negative quantity is a 400, not a silent clamp — clamping would hide a data-entry mistake.
- The same `PUT` handles name, reference, supplier and unit price, using the `?? before.field` pattern already proven on `PUT /api/equipment/:id`, so a partial update cannot blank an untouched field.

### Deletion and the in-use guard
- `DELETE /api/parts/:id` first counts rows in `work_order_parts`. If any exist, respond 400 with the affected work-order titles, not a raw `FOREIGN KEY constraint failed`.
- The guard is an explicit pre-check rather than relying on `ON DELETE RESTRICT` surfacing as an error, because the route needs the job names to build a useful message anyway.
- Deleting an unused part is a hard delete. No soft-delete flag: a part that was never used carries no history worth preserving.

### Reorder level
- New column `parts.reorder_level INTEGER NOT NULL DEFAULT 5`, added through `ensureColumn()` so existing database files migrate on next start. The default of 5 preserves today's implicit behaviour rather than changing it silently.
- The badge becomes: `qty <= 0` → red "out"; `qty <= reorder_level` → amber with the quantity; otherwise plain quantity. `<=` not `<`, so a part sitting exactly at its reorder level is flagged.
- `reorder_level` is editable in the same form as the rest of the part (PART-02/05 share one form).

### UI shape
- An "Edit" button per row opens the same fields inline in the table row, prefilled. No modal, no separate page, no router — the app has a single HTML page and no framework, and phase 7 must not introduce one.
- The delete button uses the existing `confirm()` pattern already used by `removeEquipment()`.
- Technician and admin may both restock and edit. Deleting a part is also allowed to both: unlike machine deletion (admin-only), a part has no cascading consequence once the in-use guard passes.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `route(fn, opts)` in `server.js` — every API route already gets session enforcement and constraint-error mapping for free.
- `readBody(req)` — parses and caps JSON at 1 MB; returns `null` on malformed input.
- `ensureColumn(table, column, definition)` in `db.js:100` — the established migration mechanism, one line per column.
- `transaction(fn)` in `db.js` — not needed here; single-statement writes are already atomic in SQLite.
- Front-end helpers `esc()` (HTML escaping), `badge(text, colour)` and `$(selector)` in `public/app.js`.
- CSS classes `button.small`, `button.danger`, `badge`, `b-red`/`b-amber` in `public/index.html`.

### Established Patterns
- Routes are declared in the `api` object as `'METHOD /api/path': route(handler)`.
- Mutation responses return the updated row (`SELECT * FROM parts WHERE id = ?`).
- Errors are `send(res, 400, { error: 'sentence a workshop user can act on' })`.
- Front end re-fetches the whole list after a mutation rather than patching the DOM.

### Integration Points
- `starter/server.js` — parts routes cluster near line 176, between work-order parts and PM.
- `starter/db.js` — `parts` table at line 60; `ensureColumn` calls at line 101-104.
- `starter/public/app.js` — `loadParts()`/`addPart()` at line 156.
- `starter/public/index.html` — the parts section and the parts table header at line 138.
- `starter/scripts/smoke-test.js` — Phase 4 already asserts consumption; new assertions belong beside them.

</code_context>

<specifics>
## Specific Ideas

- The 400 message for PART-04 must name the jobs. Planned shape:
  `"This part was used on: Oil leak on main ram, Spindle vibration. Remove it from those jobs first."`
- `db.js` already carries the line `// ensureColumn('work_orders', 'assigned_to', 'INTEGER'); <- example`
  as documented guidance; phase 7's `reorder_level` is the first real use of that pattern.

</specifics>

<deferred>
## Deferred Ideas

- Purchase orders / supplier restock flow — buying stock is a different domain from tracking it.
- Stock movement history ("who used what when") — belongs with the audit trail deferred to a later milestone.
- Per-location or per-bin stock — one workshop, one cupboard.
- Low-stock alerting (banner, digest file) — needs correctable data first; this phase delivers the data.

</deferred>
