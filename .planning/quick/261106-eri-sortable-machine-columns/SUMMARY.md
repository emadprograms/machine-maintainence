---
quick_id: 261106-eri
slug: sortable-machine-columns
date: 2026-11-07
status: complete
kind: quick
commit: 9bc7ab3
files_modified: [app/public/index.html, app/public/machines.js, app/public/sort.js, app/public/app.css, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# 261106-eri — the machine table's columns were headings and nothing else

**Asked for:** "whenever any user clicks on any of the column headed … name or the barcode
or the manufacturer, category, location, status — it should sort by whatever he has clicked
on … first ascending and then descending … there is this small symbol that shows whether it's
ascending or descending next to the name … the columns are static and they don't help."

## What was there

`<th>Name</th><th>Barcode</th>…` — plain cells. The list arrived in one order (`ORDER BY
e.name` from the route) and stayed in it, whatever anyone did. Nothing on the screen said
"this is sorted by name", because nothing had sorted it.

## What it is now

The six headings that hold a value are **buttons inside their `<th>`s**:

* One click → that column ascending. The same heading again → descending. A different
  heading → ascending, because the first answer to "sort by this" is the one everybody means.
* An arrow (▲ / ▼) sits beside the sorted heading, in a **fixed-width slot** that is always
  present. A heading that widens by 9px the moment it becomes the sorted one makes the table
  shift under the pointer that is still on its way to the next click.
* `aria-sort` on every heading, `ascending`/`descending` on the sorted one and `"none"` on the
  rest — the direction is said out loud, not only drawn.
* Being real `<button>`s, they are reachable by Tab and work with Enter and Space without a
  single line of keydown handling, and the cells keep saying "column header" to a screen
  reader. A `<th role="button">` would have traded one of those for the other.

**Not sortable:** the photograph column and the three-dots column. There is no order for a
picture, and the menu column holds no value at all.

### The ordering rule (`public/sort.js`)

Its own file, because the suite imports it and runs it on rows. A regex can find `sort(` and
tell you nothing about whether `9` lands before `10`.

* Numbers written as text sort as numbers — `Intl.Collator` with `numeric: true`, so a
  barcode column reads `9`, `10`, `101220054` rather than `10`, `101220054`, `9`.
* Case and accents are ignored: `pump` and `Pump` are one word to somebody scanning a list.
* A blank cell goes **last whichever way** the sort runs. Sorting Barcode descending to find
  the biggest number must not hand back a screenful of machines with no barcode.
* Ties keep the order they arrived in — a table that reshuffles two machines with the same
  category on every redraw looks broken.
* The input array is not touched. The screen keeps the list the server sent; a sort that
  quietly reordered it would make "the order it came in" unrecoverable.

### No request, no spinner

`loadEquipment()` now stores the rows and calls `drawEquipment()`, which applies the current
`sortKey`/`sortDir` and redraws. A heading click calls `sortEquipment()`, which changes the
direction and calls the same `drawEquipment()` — the table turns over from memory. The chosen
column also survives a search, a filter change, and any save that reloads the list, which is
what stops the arrows from being decoration.

## Checks — 492 → 504

Behavioural, on real rows: ascending/descending, numeric barcodes, blanks last both ways,
ties kept, input untouched. Plus the wiring: six and only six sortable headings with the
field names they sort, headings that are `<button type="button">`, first-click-ascending,
unknown keys ignored, the arrow present and `markSort()` actually called, `aria-sort` on all
six, status sorting by the word the row shows rather than `machine.status`.

## Mutations — 13, all caught

| Mutation | Caught by |
|---|---|
| collator without `numeric` | barcode sorts as digits |
| blanks sorted with the values | blanks-last |
| direction ignored | ascending/descending |
| ties reversed | ties kept |
| the caller's list reordered in place | *sorting leaves the list the server sent alone* |
| the click refetches | *the table turns over without asking the server again* |
| the reload stops redrawing | same check — the empty sentence went missing with it |
| a heading loses its column | the six-key list |
| the photograph column becomes sortable | the six-key list |
| the arrow is never drawn | `markSort()` |
| an unknown column sorted anyway | first-click check |
| status sorts by its internal value | the status mapping |

Two were **missed first** and are recorded because both were bad mutations, not bad code:
`rows.sort()` with no comparator sorts `[object Object]` and reorders nothing, and the
"unknown column" guard assertion had not actually been written — the edit batch that added it
aborted on a later assertion and wrote nothing. Both were re-run properly against the code
that was really there.

## Two things the rename in 261106-erh taught, applied here

* The column-heading check now strips tags instead of matching `>Name</th>`, so a heading may
  gain a button or an arrow without the check needing an edit — and the empty-state check
  follows the sentence into `drawEquipment()`, with the loader still required to call it, so
  a detached function cannot satisfy it.

## Not verified

No browser has clicked these headings. The ordering itself is run by the suite; what is not
proven is how the arrow looks in the real type — `th` is 11.5px uppercase, and the mark is 8px
of `--brand` blue in a 9px slot. If it reads too faintly or crowds the longer headings
(Manufacturer, Assigned-to in the other tables), that is a one-line CSS change.
