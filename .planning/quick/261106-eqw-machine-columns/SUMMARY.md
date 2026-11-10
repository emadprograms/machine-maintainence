---
quick_id: 261106-eqw
slug: machine-columns
date: 2026-11-06
status: complete
commit: a8e97f6
files_modified: [app/public/index.html, app/public/machines.js, app/public/app.js, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-eqw — category, location and photo columns

**Asked for:** "add category, location and photos column in the machines section. there are
no columns for that."

They were there and not there. The photograph had a column whose heading was empty, and
category and location had been folded onto a smaller line under the machine's name in
`261106-eqs`, when the thumbnail arrived and the table was full. Three of the seven things a
machine record holds had no heading of their own.

## The table, now

| Photo | Name | Barcode | Manufacturer | Category | Location | Status | *(actions)* |
|---|---|---|---|---|---|---|---|

The name cell carries the name again — with real columns, the second line printed the same
facts twice.

## What the checks learned

* The header is read **once**, and every claim is made against it: each column name is
  present, the row fills category and location, and **the empty row spans exactly the number
  of columns the header names** — derived from the header, not typed in, so a column added
  on one side only fails.
* `/<th/` also matches `<thead`. The first run reported nine columns for an eight-column
  table; the count is now `/<th[\s>]/`.

## Mutation proofs

Six mutations, **six caught** — after one survived.

| Mutation | Caught by |
|---|---|
| the Category column dropped from the header | *the machine table names every column it shows*, + span check |
| the Location column dropped from the header | same |
| the photo column loses its name | same (+ span check reporting 0) |
| the row stops filling category and location | *the row fills the category and location columns* |
| the empty row left stretched for six columns | *an empty table spans exactly the columns the header names* |
| category and location go back under the name | *the name column carries only the name* |

**The survivor:** putting category and location back under the name *in addition to* the new
columns passed everything — the columns were still filled, and the duplicate was invisible to
a check that only asked whether they were present. Nothing else noticed, because showing a
fact twice is not an error any query can report. The name cell is now asserted to be just the
name.
