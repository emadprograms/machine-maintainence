---
quick_id: 261106-eqp
slug: edit-the-machines
date: 2026-11-06
status: complete
files_modified: [app/public/index.html, app/public/app.js, app/routes/equipment.js, app/scripts/smoke-test.js, app/README.md, .planning/quick/261106-eqp-edit-the-machines/SUMMARY.md]
---

# Quick task 261106-eqp — a machine can be corrected

**Reported:** "there is no way to edit the machines."

## What is actually true

The API has taken a full edit since v1.0 — `PUT /api/equipment/:id` accepts name, asset
tag, category, location, status and notes. The screen never uses it for anything except
one thing: `toggleStatus()` sends `{ status }` to flip retired/active.

So a machine can be added, retired, restored, deleted and given a job history — but a
typo in its name is permanent, and **a machine cannot be marked *down* at all.** The
schema has had `status IN ('active','down','retired')` from the start and the dashboard
counts "machines down" as one of its four cards; that card could only ever read zero
because no screen writes `down`.

Two more gaps fall out of the same place:

* `equipment.manufacturer` was added by migration and is never written by any route, so
  the column is permanently null.
* `PUT /api/equipment/:id` has no name check. `name` is `NOT NULL` but `''` satisfies
  that, so a machine can be renamed to nothing and then be unidentifiable in every list.

## Plan

1. **An Edit button on every machine row**, opening a dialog filled with what is there
   now: name, asset tag, category, location, manufacturer, status, notes.
2. **`saveEquipment()`** sends the whole record with `PUT`, reloads the table, and leaves
   the dialog open with the message if the server refuses.
3. **Server:** accept `manufacturer` on both `POST` and `PUT`; refuse an empty name on
   `PUT` the way `POST` already does ("Name is required").
4. **Assertions**, written so each one fails when its defect returns: the fields really
   change, `down` is reachable, an empty name is refused, manufacturer round-trips, and
   the wiring exists (an Edit button per row, a dialog with the fields, a `PUT` to the
   right URL, a prefill from the loaded row rather than a second fetch).

## Proof of the defect before fixing it

A machine renamed through the API keeps its name in the list, but there is no control in
the page that does it: the row's buttons are Retire/Restore, History and Delete only.
The three new API assertions below are written against behaviour that has never been
exercised, and the wiring assertions against a control that does not exist yet.
