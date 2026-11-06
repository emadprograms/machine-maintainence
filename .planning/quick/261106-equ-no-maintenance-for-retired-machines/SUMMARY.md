---
quick_id: 261106-equ
slug: no-maintenance-for-retired-machines
date: 2026-11-06
status: complete
commit: 138b085
files_modified: [app/status.js, app/filters.js, app/routes/pm.js, app/routes/dashboard.js, app/public/app.js, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-equ — no maintenance for retired machines (option D)

**Asked for:** "there should be no maintenance for retired machines too." The last piece of
`261106-eqt`, left out on purpose and then asked for.

## What changed

| Where | Before | Now |
|---|---|---|
| Due soon | every schedule inside the window | machines in service only |
| Maintenance screen | every schedule | machines in service only |
| Dashboard "Due soon" card | every schedule | machines in service only |
| `GET /api/pm`, `GET /api/pm/due` | everything | `?service=active` excludes retired; **no parameter still means everything** |

`status.js` now owns the phrase as SQL — `IN_SERVICE_SQL = "e.status <> 'retired'"` — because
four queries ask it (the machine list, the two maintenance lists and the due-soon card). The
comment on that constant says what it is for: a retired machine must not appear on any of
them, and one definition is how they cannot drift.

## Nothing is deleted

A schedule on a retired machine is **parked**, not removed: retire the machine and the
reminders stop, restore it and they come back. That distinction is the whole point of
retiring rather than deleting, and it is asserted — the check that restoring brings the
schedule back is what catches a future implementation that "cleans up" on retire.

As with work orders, the API stays permissive: a schedule attached directly to a retired
machine is still a row. The screens no longer *show* it, which is what was asked.

## Mutation proofs

Six mutations, **six caught** — the sixth only after the fixture was reordered.

| Mutation | Caught by |
|---|---|
| the maintenance list stops excluding retired machines | *nor on the maintenance list* |
| the due list stops excluding them | *but it is not on the list of what is due* |
| the dashboard card counts them again | *nor in the dashboard due-soon card* |
| the Due soon screen asks for everybody | *the due list asks only for machines in service* |
| the Maintenance screen asks for everybody | *the maintenance list asks the same way* |
| retiring a machine deletes its schedules | *and its maintenance comes back with it — nothing was deleted* |

**Why the last one was missed first:** the schedule was created *after* the machine was
retired, so deleting schedules on retire had nothing to delete and the assertion passed.
Reordering the fixture — schedule first, then retire — made the same mutation fail three
checks. A proof whose setup is ordered around the defect cannot see it.

## Verified against the running app

`curl` against the preview server after the restart: with a schedule on the demo's retired
*Scrap press*, `?service=active` dropped it from `/api/pm`, `/api/pm/due` and the dashboard
card while no parameter still listed it; retiring and restoring toggled it in and out. The
browser itself was not exercised; the two screen requests are checked by reading the source,
as the rest of the screens are.
