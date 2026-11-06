---
quick_id: 261106-eqt
slug: retired-machines-out-of-the-way
date: 2026-11-06
status: complete
files_modified: [app/filters.js, app/routes/equipment.js, app/public/machines.js, app/public/index.html, app/public/app.css, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-eqt — retired machines out of the way (B + C)

**Asked for:** after asking what the Retire button actually does, the owner chose **B and C
together**:

* **B** — a retired machine must not be offered when opening a new work order or a new
  maintenance schedule, so nobody starts work on a machine that has left the workshop.
* **C** — the Machines screen shows machines in service by default, with a "Show retired"
  toggle for when you need to find one (to restore it, read its history or correct it).

No archive, no deletion, no change to the work orders already recorded: a retired machine
keeps everything it has, it simply stops appearing where new work is started.

## Decisions

* **The API keeps its old default.** `GET /api/equipment` still returns everything; the
  hiding is asked for explicitly with `?service=active`. Changing the default would have
  quietly changed every existing caller and every existing check — and `removeEquipment()`
  reads the list to confirm a machine exists before deleting it, which must work for a
  retired machine.
* **`service` is a filter like any other**, added to `equipmentFilter()` so the screen and
  any export built later cannot disagree: `active` excludes `retired`, `retired` shows only
  those, anything else is `all`.
* **One request per list, two lists.** The table and the dropdowns no longer come from the
  same array. Today the machine dropdowns are filled from whatever the search box is
  showing, so typing "pump" and then reporting a job offers only pumps — a pre-existing bug,
  fixed here because B cannot be honest otherwise: the dropdown must be "every machine in
  service", not "whatever this screen happens to be filtered to".
* **The server stays permissive.** A retired machine can still carry a *new* work order if
  somebody posts one directly; the request was to stop offering it, not to forbid recording
  that a scrapped machine was stripped for parts. The screen no longer offers it, and that is
  what was asked. Recorded here so the choice is visible rather than accidental.
* **The toggle is not remembered.** It starts off on every load, like the other filters: an
  everyday screen should not be able to stay in the "show me the scrap" state overnight.

## Shape

| File | Change |
|---|---|
| `app/filters.js` | `equipmentFilter()` understands `service` |
| `app/routes/equipment.js` | passes it through; documents the default |
| `app/public/index.html` | a "Show retired" checkbox in the Machines toolbar |
| `app/public/machines.js` | table asks for the chosen service; dropdowns ask for `service=active` with no search term |
| `app/scripts/smoke-test.js` | the filter matrix, the dropdown request, the toggle, the pre-existing dropdown bug |

## Checks to add

1. `?service=active` omits a retired machine; `?service=all` and no parameter include it.
2. A retired machine is not in the list the dropdowns are built from; restoring it puts it back.
3. The dropdown request carries no search term — the pre-existing bug.
4. The toggle exists, starts unchecked, and reaches the request.
5. The everyday list hides retired machines; with the toggle on it shows them.

Each must fail when its defect is reintroduced (mutation proofs), as usual.
