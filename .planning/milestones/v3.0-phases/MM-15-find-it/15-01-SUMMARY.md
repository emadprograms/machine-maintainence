---
phase: 15
plan: 01
status: complete
checks: 226
---

# What shipped

* **Search boxes** on Work orders (problem, notes, machine name), Machines (name, tag,
  location, category) and History, each debounced, each composing with what was
  already there.
* **`GET /api/equipment?q=`** — machines were the only list with no filter at all.
* **`GET /api/export/history.csv`** — "what did we close in October" as a file, using
  the screen's own filter and carrying no row limit, because a file is where the whole
  answer belongs.
* **`filters.js`** — one home for every WHERE clause. `history-query.js` was folded
  into it; four filters in one file beats two files that each own half a query.

# Found while doing it

* `the export buttons are on the page` asserted a *count* of handlers starting with
  `download` — 2. Adding the history export broke it, which is the assertion doing its
  job, but a count says nothing about which file you get. It now names the three.
* The history export needs `JOIN equipment` in its count query as well as its row
  query, because the search matches on the machine's name. Without it, `total` was
  counted over the wrong set — caught by writing the total into the same filter module
  instead of letting the route build its own.

# Carried forward

`COST-01…04` are untouched: no hours, no rates, no monthly report yet.
