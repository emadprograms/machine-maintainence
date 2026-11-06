---
quick_id: 261106-eqp
slug: edit-the-machines
date: 2026-11-06
status: complete
files_modified: [app/public/index.html, app/public/machines.js, app/public/app.js, app/routes/equipment.js, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-eqp — done

**Reported:** "there is no way to edit the machines." Correct, and worse than it sounds:
`PUT /api/equipment/:id` has taken a full record since v1.0, but the screen only ever used
it to flip retired/active. A machine could be added, retired, restored, deleted and given a
history — and never renamed. **`down` had no screen that could set it at all**, though the
dashboard has counted "Machines down" as one of its four cards since v2.0: that card could
only ever read zero.

## What changed

* **Edit on every machine row** opens a dialog holding the whole record: name, asset tag,
  category, location, manufacturer, status (Running / Down / Retired) and notes. It is
  filled from the row that was clicked, so opening it costs no request.
* **`saveEquipment()`** sends the record with `PUT`, closes the dialog on success, and on
  refusal leaves it open with the server's sentence beside the field.
* **`routes/equipment.js`**: `PUT` now writes `manufacturer` (a column no route had ever
  written, so it was permanently null) and refuses an empty name, which `POST` always did.
* **`public/machines.js`** — the Machines screen moved out of `app.js`, which had reached
  633 lines and tripped the project's own ≤600 rule. `app.js` keeps the one-line wrappers
  the markup already calls, exactly as it does for history and the report.

## Proof

15 new checks (262 → 277):

| Assertion | Mutation that must fail it |
|---|---|
| a machine can be renamed | — (control) |
| the whole record is corrected, not just the name | — (control) |
| a machine can be marked down | — (control) |
| the manufacturer is stored and comes back | writing the old value back → **fails, null** |
| a machine cannot be renamed to nothing | dropping the name guard → **fails, 200 with name ""** |
| every machine row offers Edit | removing the button → **fails** |
| the form is filled from the row that was clicked | removing the name prefill → **fails** |
| saving sends a PUT for that machine | — |
| the edit form carries every field / can say "down" | — |
| the machine editor is a dialog, not a sixth creating form | — |

Two assertions elsewhere had to be repaired rather than adjusted, because the change
exposed them as weak:

* **`each creating screen has its own dialog` counted to five.** It failed on a sixth form
  that is an *editor*, which is the same mistake as counting export buttons. It now names
  the five creating dialogs and checks the editor separately.
* **`every list has a written empty state`** matched `app.js`'s new one-line wrapper for
  `loadEquipment` instead of the real function. It now considers every match, so a wrapper
  cannot satisfy it and the module's body must.

Five further checks read `app.js` for rules about the client as a whole (shared row
helpers, empty states, destructive wording, search empty states, the way into a machine's
history). They read every client file now — a rule that holds in one file stops being a
rule the moment a screen moves.
