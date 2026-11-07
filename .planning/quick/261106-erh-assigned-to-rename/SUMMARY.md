---
quick_id: 261106-erh
slug: assigned-to-rename
date: 2026-11-07
status: complete
kind: debug
commit: pending
files_modified: [app/public/index.html, app/routes/work-orders.js, app/routes/record.js, app/public/app.css, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# 261106-erh — "Owner" is now "Assigned to"

**Asked for:** "Changed the name Owner to 'Assigned to'" — and run it as a debug pass.

## Step 1 — where the word actually is

Grepped the shipped files rather than trusting memory. Seven sites, and they are not all the
same kind of thing:

| # | Site | Kind | Changed |
|---|---|---|---|
| 1 | `machine-history` dialog header | label a person reads | yes |
| 2 | Work orders table header | label | yes |
| 3 | History table header | label | yes |
| 4 | Work order editor `<span>` | label | yes |
| 5 | `work-orders.csv` column | header a person reads in Excel | yes |
| 6 | `history.csv` column | header | yes |
| 7 | `app.css` comment ("two Owner fields") | prose about the code | reworded |

**Not changed, on purpose:** the API and the database. `assigned_to`, `assignee_name` and the
CSV key `owner` stay exactly as they were — a rename of what a word *looks like* must not
rename the fields other code, exports and tests depend on. One check now holds that line: the
list still carries `assigned_to` and `assignee_name`.

## Step 2 — the bug the rename found

Three tests failed, and only one of them for a good reason.

`ok('the header names the same columns as the screen')` compared the CSV header to **another
hard-coded string**. It never read the screen. So the check promised something it did not do,
and a screen and a file drifting apart — the exact failure it is named for — would have passed.

It now reads the work-orders table header out of `index.html` and requires the shared columns
(Machine, Problem, Assigned to, Priority, Status) to be spelled the same in both. That change
alone caught two of the five mutations below.

One small trap on the way: the CSV block runs before `indexEq` is defined, so the first version
of the fix was a `ReferenceError: Cannot access 'indexEq' before initialization` — the page is
read locally there now.

## Step 3 — proof

Five mutations, **five caught.**

| Mutation | Caught by |
|---|---|
| one table still says Owner | *nothing a person reads calls the assignee an owner*, and the header count |
| the editor still says Owner | *the editor has exactly one Assigned-to field*, and the stale-word check |
| a CSV column still says Owner | *the header names the columns the way the screen names them* |
| a CSV column says "Assignee" instead — no "Owner" anywhere | the same screen-vs-file check |
| the API field is renamed along with the label | five checks, incl. *work order can be reassigned* |

The fourth matters most: a check that only looks for the old word would pass a half-thought
rename to a third word. The screen-vs-file comparison catches any disagreement, not just this
one.

## Step 4 — checks

Three added, 489 → 492:

* **nothing a person reads calls the assignee an owner** — page plus both route modules,
  covering `<th>Owner</th>`, `<span>Owner</span>` and `label: 'Owner'`.
* **every screen and both files call it Assigned to** — three table headers, the editor label,
  and both export columns, counted rather than hoped for.
* **and the API still calls the field what it always did** — `assigned_to` and `assignee_name`
  are in the row.

## Not verified

Nobody has opened the renamed screens. "Assigned to" is wider than "Owner"; the tables have
`white-space` rules that have not been re-read against the longer word, and the History column
is narrow. If it wraps awkwardly, that is a CSS follow-up — the rename itself is done.
