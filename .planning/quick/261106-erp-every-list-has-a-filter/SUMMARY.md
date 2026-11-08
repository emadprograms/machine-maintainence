---
quick_id: 261106-erp
slug: every-list-has-a-filter
date: 2026-11-07
status: complete
kind: quick
commit: pending
files_modified: [app/public/index.html, app/public/app.js, app/public/parts.js, app/filters.js, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# 261106-erp — a checkbox is not a filter

**Asked for:** "just like the machines section has a filter, the rest should have a filter
button. there is a check mark in the spare parts section. change that."

## What was there

| Screen | Toolbar |
|---|---|
| Machines | search + a four-answer `<select>` |
| Work orders | search + a status `<select>` |
| History | search + a date range |
| Due soon | a "within N days" `<select>` |
| Report | a month picker |
| **Spare parts** | **a checkbox**: "Only parts at or below the reorder level" |
| **Maintenance** | **nothing** |
| **Users** | **nothing** |

A checkbox can say one thing and only one thing, and it cannot be combined with anything —
including the search box the screen did not have.

## Now

| Screen | Filter |
|---|---|
| Spare parts | **All parts / At or below the reorder level / Out of stock**, plus a search box |
| Maintenance | **All schedules / Due within 7 days / Overdue** |
| Users | **All accounts / Active / Disabled / Administrators** |
| Work orders | unchanged, but its "Any status" is now marked `selected` like the rest |

Every filter is a `<select>` with an `aria-label`, and every one states its "everything"
answer as `selected` — the machines screen was the only one that did.

Spare parts and its CSV share one `partQuery()`: the file is the list you are looking at.
Maintenance and users filter a list already in memory, so changing the answer is a redraw,
not a request — the same rule as clicking a heading.

## The bug underneath the checkbox

`partsFilter()` returned early:

```js
if (query.low) return { sql: 'WHERE p.qty <= p.reorder_level' };
if (query.q)   return { sql: 'WHERE (name LIKE ? OR reference LIKE ?)' };
```

So low stock **and** a search could not be asked together — the first one won and the search
was silently dropped. It was invisible while the screen had no search box; adding one would
have produced a search box that did nothing whenever the filter was on. The clauses now add
up, and `out=1` is its own answer rather than a synonym for "low".

## app.js crossed the split signal a third time

Adding the filters put app.js at 608 lines, past the repository's 600-line rule. The spare
parts screen moved into `public/parts.js` — filter, table, dialog and CSV — leaving app.js at
469 lines and the parts screen shaped like the other five.

## Checks — 523 → 531

* **the low-stock filter returns the parts at or below their own level**;
* **out of stock is its own answer, not a synonym for low**;
* **a filter and a search narrow each other instead of replacing each other** — the one that
  fails against the old early-return code;
* **the file the download produces is the list the filter would show**;
* **every list says what would narrow it, and each opens on everything** — the five selects,
  their `aria-label`, their "all" answer, and that it is `selected`;
* **the spare parts checkbox is gone, not hidden** — named, not counted;
* **the parts file asks the same question as the parts table**;
* **the maintenance and user filters redraw, they do not refetch** — and both comparisons in
  each branch, because "overdue returns true for everything" passed a looser version.

Nine earlier checks were re-pointed from `app.js` to `parts.js` rather than deleted.

## Mutations — 10, all caught

| Mutation | Caught by |
|---|---|
| low stock and the search are alternatives again | the combined filter/search check |
| `out` means low | two checks, incl. the CSV |
| the parts filter is a checkbox again | the id contract and the export check |
| a filter opens on something other than everything | *each opens on everything* |
| the download ignores the filter on screen | *asks the same question* |
| the user filter refetches | *redraw, not refetch*, and no-table-refetches |
| the maintenance filter stops filtering | *redraw, not refetch* — **after** the check was tightened |
| overdue means due this week | as above |
| disabled accounts show as active | as above |
| the stock CSV returns everything | the CSV check |

## Not verified

No browser has used these filters. The maintenance filter reads `days_left`, which the server
computes from `next_due`; a schedule due *today* counts as "within 7 days" but not as
overdue, and nobody has confirmed that reads the way a workshop expects.
