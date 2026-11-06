---
quick_id: 261106-erc
slug: work-order-report-and-close
date: 2026-11-06
status: complete
commit: 1ee67af
files_modified: [app/db.js, app/values.js, app/routes/work-orders.js, app/routes/equipment.js, app/routes/record.js, app/filters.js, app/public/index.html, app/public/app.js, app/public/work.js, app/public/history.js, app/public/app.css, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-erc — what a work order should be

**Asked for:** "what are the things that should be there in a work order", then — asked which
slice to build — **both, report first**.

Two commits: `1ee67af` (the report) and `8473f68` (the close). Checks **404 → 448**.

## The audit that started it

| Field | In the database | In the form | Editable later |
|---|---|---|---|
| Machine, problem, priority | yes | yes | partly |
| Notes | **yes, since v2.0** | **no box anywhere** | API only |
| Owner | yes | no | yes, inline |
| Labour hours | yes | **asked at creation** | yes |

Two of those were bugs, not choices: `POST /api/work-orders` has accepted `notes` since v2.0
while no form offered a box, and hours were asked for at the moment nobody can know them.

## Part one — the report (`1ee67af`)

* **Notes** — a real textarea on the report form, trimmed, null when blank.
* **Reported by** (`work_orders.reported_by`) — free text, 120 characters. Not a user id: the
  person who hears the noise is standing at the machine, not signed in.
* **Photograph of the fault** (`work_orders.photo`) — bytes to `/api/work-orders/:id/photo`,
  same sniffed type and 2 MB cap as a machine photograph, stored as a file beside the
  database. **Any signed-in person may attach or remove one**, which is the deliberate
  difference from the admin-only machine photograph: a technician is exactly who needs it,
  and a blurred photo left in the record is worse than a deleted one.
* Deleting a machine removes its jobs' photographs too, or a backup keeps files nothing can
  ever point at.
* The row links to the photograph beside the problem (`link-photo`), because the table is
  about the job and the picture is what you open next.
* The 2 MB refusal and the upload moved to one `postPhoto()` in app.js, shared with the
  machine editor, rather than copied into it.

## Part two — the close (`8473f68`)

Closing used to be one click, and it was the only place a repair ever got written down.

* A dialog (`#work-close`) asks: **what was done** (required), hours, who checked it, and
  parts used — added from the same shelf the Parts screen counts, moving stock immediately.
* The server refuses a job that is *being* closed with no account of the repair:
  `400 Say what was done before closing the job`. The rule is about the **transition**, not
  the state: a later change to a closed job does not ask again, and a job reopened because
  the fix failed must be closed with a *new* account rather than inheriting the story of the
  repair that did not hold.
* Reopening keeps what was done and clears the closed date.
* `work_orders.resolution`, `.verified_by`.
* History shows what was done under the job title; `history.csv` has its own
  `What was done` column.

## The split nobody asked for

The close dialog pushed `public/app.js` past the repo's own 600-line signal, and the suite
said so. The work-orders screen moved to **`public/work.js`** — the same shape as
`machines.js` and `history.js` — with thin wrappers left in `app.js` so every inline
`onclick` still resolves. app.js: 598 → 476 lines.

## Mutation proofs

**Eighteen mutations, eighteen caught** — after one survived.

Report half (8): reported_by not stored · name not trimmed · 120-character cap dropped ·
`{ raw: true }` lost (every upload answers "not valid JSON") · photo size cap raised ·
machine delete leaves job photos · form loses the photo field · row loses the link.

Close half (10): no resolution required to close · a reopened job inherits the failed
repair's story · history SQL drops the repair · CSV drops the column · history screen stops
showing it · `advance()` closes without the dialog · browser allows an empty account · close
stops sending the resolution · dialog loses the parts picker · **the parts picker's stock
refresh removed**.

**The one that survived first:** deleting the stock refresh from `usePart()` passed, because
the assertion searched the whole file and the same line exists in `openWorkClose()`. The
check now extracts the `usePart()` body and requires the POST, the refresh, the re-render and
the used-parts list inside it. A file-wide search cannot tell one call site from another.

## What is still not there

Named so the gap is a decision:

* **A due-by date.** Priority says how bad, not by when.
* **Downtime** — when the machine stopped and how long it was down.
* **A human-readable job number** (`WO-2026-014`) for anything sent to a vendor.
* **A safety flag** that outranks `high`.
* **Vendor, PO and invoice cost** for outside repairs.
* **The PM schedule that spawned a job**, so a recurring task and its work are linked.
* Nothing here has been clicked in a browser. The suite reads the markup, the templates and
  the routes; the dialog, the parts picker and the photo upload have never been used by a
  person.
