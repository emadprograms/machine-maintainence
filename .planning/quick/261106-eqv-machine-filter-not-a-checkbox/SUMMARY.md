---
quick_id: 261106-eqv
slug: machine-filter-not-a-checkbox
date: 2026-11-06
status: complete
commit: 2376216
files_modified: [app/routes/equipment.js, app/filters.js, app/public/machines.js, app/public/index.html, app/public/app.css, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-eqv — a filter, not a checkbox

**Asked for:** "in machines don't show *show retired*. give a filter button and the user
should be able filter based on what he wants."

## What changed

| Before | Now |
|---|---|
| a **Show retired** checkbox: two states — hide the scrap, or show everything | a **filter** with four views: In service (default), Down right now, Retired, All machines |
| `?status=` filtered the stored column, where `down` has not lived since `261106-eqs` — so it silently returned nothing | `?status=` filters the **derived** state, after `status.js` has worked it out |
| no way to ask "what is down right now" | that is a view |

The search box narrows whichever view is chosen, and each view has its own empty-state
sentence — "Nothing is down right now." is not the same as "No machines yet."

## Decisions

* **The four views name their own query** in one table (`VIEWS` in `machines.js`), so the
  table cannot be drawn from a different set than the one the filter names.
* **The status filter moved to the derived value.** The raw column now holds only
  `active`/`retired`; `?status=down` against it was a parameter that could never match. It
  is a JavaScript filter in the route because the value does not exist until `withStatus()`
  has run — a WHERE clause cannot see it.
* **The dropdowns that start new work were not touched.** They still ask for machines in
  service, unfiltered, whatever the table is showing. Choosing *Retired* to find a machine
  does not make it offerable again.
* **The checkbox and its CSS rule are gone**, not hidden: dead selectors are how a screen
  drifts from its stylesheet.

## Mutation proofs

Eight mutations, **eight caught** — after one survived.

| Mutation | Caught by |
|---|---|
| the route ignores `status` | *the API can be asked for the machines that are down*, *and that answer is not the whole list* |
| every view uses the `in` query | *the chosen view is the one that is used* |
| the "down" view stops asking for down machines | *each view asks the server for the machines it names* |
| the "retired" view stops asking for retired machines | same |
| the four options collapse to one | *the four views are in service, down, retired and everything* |
| the list opens on "all" instead of "in service" | *the everyday view — in service — is the one it opens on* |
| a view loses its own empty message | *a view that finds nothing says which view found nothing* |
| the checkbox comes back and the filter goes | *the Machines screen filters by a named view*, + the id-lookup check |

**The one that first survived:** replacing the lookup with `VIEWS.in` passed every check.
The assertions proved the four views were *defined* and never that the chosen one was
*used* — the same shape as the `?service=retired` mistake in `261106-eqt`: a check on the
declaration rather than on the behaviour. It now reads
`VIEWS[$('#eq-filter')?.value]` and fails when the lookup is bypassed.

**Also repaired, not relaxed:** *"the machine editor carries no status control"* searched the
whole page for `<option value="down">`, which the new filter legitimately contains. The check
now reads inside the `equipment-edit` dialog, which is what it was always about.

**Made non-vacuous:** `?status=down` was asserted with `every(...)` on the list. On an empty
database that passes for the wrong reason, so the check now creates a machine, puts a
high-priority job on it, and requires the machine to be *in* the answer and the answer to be
shorter than everything.

## Verified against the running app

`curl` against the preview: `/api/equipment?status=down` returned only the down machine,
`?service=active&status=down` kept it and still excluded the retired one, `?service=retired`
returned only retired machines, and the page serves the new `eq-filter` select with *In
service* first. The browser itself was not exercised; the view wiring is checked by reading
the source.
