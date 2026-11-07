---
quick_id: 261106-ere
slug: stops-machine-and-number
date: 2026-11-07
status: complete
commit: fd0ad4c
files_modified: [app/db.js, app/codes.js, app/values.js, app/status.js, app/routes/work-orders.js, app/routes/record.js, app/filters.js, app/public/index.html, app/public/work.js, app/public/history.js, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-ere — does this stop the machine, and what is its number

**Asked for:** "when creating the work order it needs to specify whether the machine is still
running or not … just because a work order for a machine is created doesn't automatically make
it down … and it needs to generate a work order number that will in future be used for
tracking."

## The rule was a guess

`status.js` said: *down if any unfinished job is high priority or already in progress*. So
filing a fault took a running machine out of service on the strength of a dropdown nobody
thought about, and there was no way to record the sentence every fitter says — *it is still
making parts, this can wait until Friday*.

| Before | Now |
|---|---|
| high-priority open job ⇒ down | the ticket says so, or the machine runs |
| in-progress job ⇒ down | the ticket says so, or the machine runs |
| reason: `Mast cracked (high, open)` | reason: `WO-2026-0007 Mast cracked` |

`work_orders.stops_machine` is asked on the report form — *Does this stop the machine?* —
with **No, it is still running** selected by default. The inline editor carries a small
toggle, so a wrong answer can be corrected without closing the job and without touching the
machine record.

**Deliberately not done:** the flag does not force the job to be *in progress* or change its
priority. It answers one question — is the machine available — and priority keeps answering
the other one — how soon.

## The number

`work_orders.code`: **`WO-2026-0001`**, one series per year.

* Given by the server at creation. A client that sends its own number is ignored, or two
  jobs would share one on the phone.
* Never renumbered: an edit, a reopen or a close leaves it alone.
* Serialized, not random: a person can see that 0007 came after 0006 and that none is
  missing. (`codes.js`, 24 lines: `formatCode` and `nextWorkOrderCode`. Past 9999 the number
  grows a digit, and the query orders by length first so `10000` is not read as `1000`.)
* A **unique index** makes "no two tickets share a number" a property of the database rather
  than a habit of the route.
* Shown: under the problem on the list, beside the job in History, at the top of the close
  dialog, and as a column in `work-orders.csv` and `history.csv` (with `Stops the machine`).
* **Existing jobs are numbered on upgrade** — `ROW_NUMBER() OVER (PARTITION BY year)` over the
  rows that have no code, oldest first, so the numbers match the order the jobs were raised.
  Idempotent: a row that already has one is left alone, and a second start says nothing.

## Checks

Twenty-one added, covering numbers (format, year, sequence, uniqueness, client cannot
choose, not renumbered by an edit, migration of an unnumbered database) and the flag
(default still running, one answer takes it down, the reason carries the number and the
title, the answer can be taken back without closing, the form asks and the row says).

Three existing assertions were **rewritten rather than deleted**, because the rule they
pinned is the rule this task changed: *a high-priority job puts the machine down* is now
*a high-priority job does not put the machine down by itself*, and the technician's
high-priority report no longer takes a machine out of service until the ticket says so.

## Mutation proofs

Eleven mutations, **eleven caught** — after one survived.

| Mutation | Caught by |
|---|---|
| every ticket is number one | uniqueness, then the unique index |
| the number loses the year | the format check, and the CSV fixtures |
| a client can choose its own number | *a client cannot choose its own number* |
| old jobs are never numbered | *numbered on upgrade, per year and oldest first* |
| the machine follows the priority again | five checks, incl. both rewritten ones |
| the flag is ignored and nothing is ever down | nine checks |
| the flag is not recorded at all | ten checks |
| an edit cannot change the answer | seven checks |
| the report form stops sending the answer | *the answer it gives is the one that is sent* |
| the form presumes the answer is yes | *defaults to still running* |
| **the row stops saying a job is holding the machine down** | *and says so when a job is holding the machine down* |

**Why one survived:** the assertion searched `work.js` for the words *stops the machine*, and
the inline editor's `<option>` says exactly those three words. Deleting the row's badge passed
until the check was pinned to `badge('stops the machine', 'red')` — inside the row template,
where the claim is actually made.

## Not verified

Nobody has clicked the new select or read a number off the screen. The form, the badge, the
inline toggle and the numbering have been exercised through the API and by reading the
markup — not by a person with a broken machine in front of them.
