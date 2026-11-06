---
phase: 14
plan: 01
status: complete
checks: 215
---

# What shipped

* **`GET /api/history`** — one query, filtered by machine, status and a closed-date
  range. Returns `{ rows, total, shown }`, the last two so a capped list is honest.
* **History screen** — closed jobs, newest first, with a "closed from / closed to"
  range, a summary line and a Clear button. Reachable from the sidebar.
* **Machine history dialog** — every job ever reported against one machine, open ones
  included, opened from a History button on the machine's row.
* **Three empty states, not one**: nothing reported against this machine; nothing
  closed in that range; the request failed. They read differently on purpose.

# Two assertions the phase had to fix rather than work around

1. `each creating screen has its own dialog` was hard-coded to "exactly 5 dialogs", so
   any reading dialog broke it. It now counts dialogs containing a form grid — which is
   what "creating" meant.
2. `no form sits on a page outside a dialog` was **vacuous**: it matched
   `class="form-grid"` while the markup says `class="form-grid form-grid-wide"`, so the
   pattern could never match and the check could never fail. It now matches
   `class="form-grid`, and passes for the right reason.

The same broken pattern was in the new creating-dialog count; it reported
`0 creating dialogs` and that is how it was found.

# Not done in this phase

Search and date filters on the work order list, and everything in phases 15 and 16:
`FIND-01…04` and `COST-01…04` are untouched.
