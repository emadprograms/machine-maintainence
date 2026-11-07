---
quick_id: 261106-eqt
slug: retired-machines-out-of-the-way
date: 2026-11-06
status: complete
commit: d82c557
files_modified: [app/filters.js, app/routes/equipment.js, app/public/machines.js, app/public/index.html, app/public/app.css, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-eqt — done (B + C)

**Asked first, then answered:** "what exactly does the retire button do?" The honest answer
was *one field, a badge, and a way out of the "Machines down" count* — the machine stayed in
every list and could still take new work. The owner chose **B and C**: keep retired machines
out of the dropdowns that start new work, and hide them from the everyday Machines list
behind a toggle.

## What changed

| Where | Before | Now |
|---|---|---|
| `GET /api/equipment` | one list, everything | `?service=active` excludes retired, `?service=retired` returns only retired, **no parameter still means everything** |
| Machines screen | showed every machine, always | machines in service, with a **Show retired** box in the toolbar; off on every load |
| Report a job / Add maintenance dropdowns | every machine — and only those matching the search box | every machine in service, unfiltered |
| a retired machine | still offered for new work | not offered; its record, history, photographs and existing jobs are untouched |

## Decisions recorded

* **The API default did not move.** Changing it would have changed every existing caller —
  including `removeEquipment()`, which reads the list to confirm a machine exists before
  deleting it, and must still find a retired one.
* **The dropdowns got their own request.** They were filled from `rows`, the array the table
  is drawn from, so the search box silently narrowed them: search "pump", report a fault, and
  only pumps were on offer. B could not be honest while that was true.
* **The toggle is about what is shown, never about what work may start.** With Show retired
  on, the table lists retired machines; the dropdowns still do not offer them.
* **The server stays permissive.** A direct `POST /api/work-orders` against a retired machine
  is still accepted — the request was to stop *offering* it, and a scrapped machine being
  stripped for parts is a job worth recording. The screen no longer offers it.
* **Not done (option D).** The "due soon" list still shows maintenance schedules for retired
  machines. Chosen deliberately, and the next thing to revisit if it nags.

## Mutation proofs

Nine mutations, **nine caught** — after one assertion proved too weak to fail.

| Mutation | Caught by |
|---|---|
| `service=active` stops excluding retired | *a retired machine is not offered as a machine in service* (+2) |
| `service=retired` stops filtering | *?service=retired answers with the ones that left, and only those* |
| `service=all` stops meaning everything | *?service=all means everything, like no parameter at all* |
| dropdowns come from the filtered table again | *the dropdowns that start new work never come from the filtered table* |
| the dropdown request carries the search term | *and they ask for machines in service with no search term* |
| the toggle is ignored | *the list asks for the service the toggle names* |
| the toggle starts checked | *and it starts off, so the everyday list is machines in service* |
| the toggle is removed | *the Machines screen offers a "show retired" toggle*, + the id-lookup check |
| the empty state stops mentioning the toggle | *an empty list says that retired machines are hidden* |

**The weak one, kept in the record:** `?service=retired` was first asserted as "contains the
scrapped machine" — which the *unfiltered* list also satisfies, so deleting the filter clause
still passed. It is now "only retired machines, and it is there". This is the second time in
this task that a containment check could not fail; the shape of the mistake is always the
same, and the mutation run is what catches it.

A follow-up commit (`02cfa18`) fixed the empty state: with retired machines hidden,
"clear the search" was the wrong advice when the machine being looked for had simply left.

## Verified against the running app

The preview server was driven with `curl`: the machined list without a parameter still returns
everything; `?service=active` dropped the retired machine and nothing else; `?service=retired`
returned exactly it; restoring it brought it back into the in-service list. The browser itself
was not exercised — the toggle is checked by reading the source, as the rest of the screens are.
