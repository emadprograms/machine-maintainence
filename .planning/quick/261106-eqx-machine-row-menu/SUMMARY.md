---
quick_id: 261106-eqx
slug: machine-row-menu
date: 2026-11-06
status: complete
commit: 7b9d64c
files_modified: [app/public/machines.js, app/public/history.js, app/public/index.html, app/public/app.css, app/public/app.js, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-eqx — three dots, and a delete that asks for a name

**Asked for:** "the edit, history and everything else in the machine section should be inside
the 3 dots… delete should be in red… the user should be informed that clicking delete will
delete all the work orders and everything related to that machine… the person should type
'delete machine so and so'."

## What changed

| Before | Now |
|---|---|
| four buttons on every row: Edit, History, Retire, Delete | one **⋮** menu at the end of the row, with the same four |
| Delete was a grey `confirm()` — same weight as "History" | red **Delete machine**, opening a dialog |
| a dialog would have said "this cannot be undone" and little else | it counts what goes: *"Deletes 3 work orders and 1 maintenance task, the whole of its history, and its photograph."* |
| one click | the button stays disabled until **`delete machine <name>`** is typed, and the sentence is checked again before the request goes |

The menu closes when you pick something and when you click anywhere else; it closes on
scroll, because it is positioned against the viewport.

## Two bugs of my own, found by building this

1. **The menu would have been clipped.** `.table-wrap` scrolls sideways, and a child
   positioned absolutely inside it is clipped on the other axis too — a menu on the last row
   would have been cut off. The menu is `position: fixed`, placed from the three dots'
   bounding box when it opens, and closed on scroll or resize.
2. **The History dialog has been naming itself after the wrong cell.** It read
   `tr.querySelector('td')` — the *first* cell — for the machine's name. That was correct
   until the photograph took the first column in `261106-eqs`; since then a pictureless
   machine was titled with its placeholder letter ("A" for Air compressor). It reads
   `.cell-strong` by class now, so column order cannot break it again.

## The promise the dialog makes, proved

A dialog that overstates what it destroys is worse than none, so the claim is asserted
against the API: a machine with a job and a maintenance schedule is deleted, and both are
checked gone afterwards (`ON DELETE CASCADE`). Its photograph is covered by the earlier
`261106-eqs` check.

## Mutation proofs

Twelve mutations, **twelve caught.**

| Mutation | Caught by |
|---|---|
| the row goes back to loose buttons | *everything about a machine sits behind three dots* |
| the menu loses History | *the menu holds edit, history, retire and delete*, + two older checks |
| delete stops being the red item | *delete is the red item in it* |
| the red item stops being red in CSS | same |
| the delete button is never disabled | *the button is disabled until the sentence is typed* |
| the sentence stops naming the machine | *the sentence names the machine that will go* |
| confirming stops re-checking the sentence | *confirming checks the sentence again before calling the server* |
| the dialog stops counting what goes | *the dialog counts what is about to be destroyed* |
| the warning stops calling it permanent | *deleting a machine names it and says what happens* |
| the menu goes back to absolute positioning | *the menu is not clipped by the table it lives in* |
| the menu stops closing on scroll | *and it closes when the page moves under it* |
| the history dialog reads the first cell again | *the history dialog reads the name column, not the first cell* |

Two older assertions were repointed rather than deleted: *"deleting a machine names it and
says what happens"* now reads the dialog instead of the `confirm()` string, and *"Edit,
Retire and Delete are drawn only for an admin"* now looks for `openEquipmentDelete` in
`actions()`.

## Not verified here

The menu's appearance, its placement on the last row, and the disabled-button behaviour in a
real browser. The suite reads the source and the API; nobody has clicked it.
