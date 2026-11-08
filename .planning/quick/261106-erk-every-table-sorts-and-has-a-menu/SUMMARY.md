---
quick_id: 261106-erk
slug: every-table-sorts-and-has-a-menu
date: 2026-11-07
status: complete
kind: quick
commit: pending
files_modified: [app/public/index.html, app/public/tables.js, app/public/machines.js, app/public/work.js, app/public/history.js, app/public/report.js, app/public/app.js, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# 261106-erk — every table, not just the machine one

**Asked for:** "the spare parts page should be like the machine page. 3 dots for options.
re-orderable table. **all tables and all options should be like that**."

## What was there

One table sorted (machines, 261106-eri). One table had a menu (machines, phase 15). The other
eight had plain `<th>`s and a row of buttons each: work orders had *Move to in progress* and
*Edit*, parts had *Edit* and *Delete*, maintenance and due soon had *Mark done*, users had
*Disable* — every one of them repeated on every row.

## What it is now

Two things moved into one shared module, `public/tables.js`:

* **The heading click**: which column, which way, the arrow, `aria-sort`, and the state that
  survives a redraw. A table registers once with `register(tbodyId, columns, redraw)` — the
  columns it can sort and how to draw itself. Everything else is the same for all nine.
* **The row menu**: the `<details>` markup, the `aria-label="Actions for …"` name, the
  fixed-position placement under the three dots, and the close-on-click-away and
  close-on-scroll rules.

| Table | Sortable columns |
|---|---|
| Due soon | machine, task, every, due |
| Machines | name, barcode, manufacturer, category, location, status |
| A machine's history | job, status, assigned to, opened, closed |
| Work orders | machine, problem, assigned to, priority, status, hours, cost |
| History | machine, job, closed, assigned to, priority |
| Spare parts | name, reference, in stock, unit price, reorder at |
| Maintenance | machine, task, every, last done, next due |
| Users | name, email, role, status |
| Report | machine, jobs, hours, parts, labour, total |

**47 headings, all of them buttons**, each with an `aria-sort` slot that starts at `none`.

Menus: machines (edit, history, retire, delete), work orders (move/close/reopen, edit),
spare parts (edit, delete), maintenance (mark done on that day), due soon (mark done today),
users (enable/disable). History and the report have no actions, so they have no menu — and no
empty last column either.

**Where the alphabet is the wrong order, the column says so.** Priority runs high → medium →
low and status runs open → in progress → done. Sorting priority alphabetically would read
*high, low, medium*, which is not an order anybody meant.

**The maintenance row keeps its date picker.** "Mark done on" is a value, not an action —
it stays in its column, and the *Mark done* button moved into the menu beside it.

## Checks — 513 → 522

The new ones are deliberately table-wide rather than one-per-screen:

* **every table sorts by each of its headings, and only by headings it can sort** — the keys
  in the markup are matched against the keys in that table's `register(…)` map, so a heading
  offering a column the code cannot sort is a failure (the mutation that renamed `qty` to
  `stock` was caught by this alone);
* **every one of them keeps the order and says which way it is going** — `markTable` called
  for all nine;
* **every table has a heading for every column its row draws** — compared with the column
  count its empty row states. This caught the maintenance header missing the menu column;
* **no table asks the server again when a heading is clicked** — no `api(`/`fetch(` inside any
  of the nine draw functions;
* **and the click finds the table the heading belongs to**;
* **a row never carries its own buttons, whatever the table is** — six menus for six tables
  with actions, and no `<td><button class="ghost small"` anywhere;
* **and a menu names the row it belongs to**;
* **the items are real buttons, and a destructive one is marked**;
* **priority and status sort in the order the workshop means**.

Thirteen checks that used to read `machines.js` were re-pointed at `tables.js` rather than
deleted — the menu's positioning, its close rules and its danger styling are still checked,
just where the code now lives.

## Mutations — 12, all caught

heading key renamed · a table drawn without marking its arrow · the maintenance header losing
its menu column · sorting that refetches · a row getting its buttons back · a table losing its
menu · a menu item that is not a `<button>` · delete losing its danger styling · the menu
button losing its accessible name · a heading sorting whichever table is first on the page ·
priority sorted alphabetically · the second click staying ascending.

## Two self-inflicted errors, recorded

* `[^)]*` and `[\s\S]*?` inside these checks bit me twice: one regex ran from one screen's
  registration into another's because all client files are one string in the suite, and one
  assumed `drawX()` had empty parentheses when `drawMachineHistory(name = …)` does not. Both
  fixed by bounding the slice and allowing parameters.
* The first attempt at the maintenance header added the menu cell to the row and not the
  header — caught by the new parity check, which is exactly why it exists.

## Not verified

No browser has clicked any of these 47 headings or opened any of these menus. Ordering is run
by the suite on rows; what is not proven is how the arrows read in the real type, whether the
maintenance row is too wide now that it has seven columns, and whether a menu near the bottom
of a long table opens upwards as comfortably as it should — the placement rule lifts it left
but never up.
