---
quick_id: 261106-erf
slug: edit-work-order-dialog
date: 2026-11-07
status: complete
commit: fb68977
files_modified: [app/public/index.html, app/public/work.js, app/public/app.js, app/public/app.css, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-erf — editing a work order opens a dialog

**Asked for:** "when editing a work order a dialog should open … the editing is not very
detailed, I cannot change whether the machine is now down or not … the edit should open the
dialog."

## What the inline editor could do

| | Inline row editor | The record holds |
|---|---|---|
| Problem | yes | yes |
| Owner | yes | yes |
| Priority | yes | yes |
| Hours | yes | yes |
| Whether it stops the machine | a dropdown squeezed into the status cell | yes |
| Who reported it | **no** | yes |
| What was seen (notes) | **no** | yes |
| Photograph | **no** | yes |
| Number | not shown | yes |

Eight real fields, four of them editable, and the newest and most consequential one — *does
this stop the machine* — crammed beside a status badge.

## What it is now

`#work-edit`, a dialog with the same shape as the report form and the close dialog:

* **Problem**, **Owner**, **Priority**, **Does this stop the machine?**, **Hours**,
  **Reported by**, **What you saw**, and the **photograph** — with a link to the current one,
  a file input to replace it, and a *Remove the photograph* checkbox.
* The heading carries the number and the job (`WO-2026-0018 · Press — Bearing noise`), so the
  person editing knows exactly which ticket is open.
* Filled from `workCache` — the row that was clicked — rather than a second request for a
  record the page already has.
* **One Save** writes all of it in a single PATCH; the photograph goes last, so a failed
  upload cannot lose the edit that was just saved.

## The quiet bug that came with it

A technician cannot read `/api/users/assignable` (the list of people). The inline editor
rendered its owner `<select>` anyway, empty; saving would have sent `assigned_to: null` and
**unassigned the job** as a side effect of fixing a typo in the title.

So: when the list cannot be read, the dialog shows the owner as a read-only name with a line
saying why, and the save leaves `assigned_to` out of the body entirely. A field that could not
be read must not be written.

## Checks

Ten added. Source: the dialog carries every field, the list has no editor left in it, the
prefill reads the row and does not call the API, one Save sends every field, an empty problem
is refused before it reaches the server, the owner is not sent when the list was not readable,
the photograph can be replaced or removed and the checkbox is what decides.

Behaviour, through the API: one PATCH writes every field the dialog offers, keeps the owner,
the number and the status it never mentioned, and the machine follows the answer given in the
editor.

## Mutation proofs

Eight mutations, **eight caught** — after two survived.

| Mutation | Caught by |
|---|---|
| the editor loses the stops-machine control | the id lookup, *the dialog carries the whole record*, and the answer check |
| the editor loses the notes field | the id lookup, and the whole-record check |
| the save stops sending the notes | *one Save sends everything the dialog asked for* |
| the save stops sending the machine answer | same, plus the answer check |
| the owner is sent even when the list was not readable | *a technician editing a job cannot silently unassign it* |
| the list draws inputs again | *the list itself has no editor left in it* |
| **the dialog fetches the job instead of reading the row** | *filled from the row that was clicked* |
| **removing the photograph stops working** | *the photograph can be replaced or removed* |

**Why two survived first:** the prefill check searched all of `work.js` for `workCache.find`,
and the *close* dialog reads `workCache` too — so `editWork` could be rewritten to fetch the
job and nothing noticed. And the photograph check only looked for the DELETE call, which is
still there when the checkbox stops deciding anything. Both now read the specific function
and require the binding, not the mention.

## Not verified

Nobody has opened the dialog in a browser: that the prefill looks right, that the read-only
owner line appears for a technician, and that the photograph preview line reads well are all
judgements made from the markup.
