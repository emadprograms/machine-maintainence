---
quick_id: 261106-eqs
slug: machine-status-from-work-orders
date: 2026-11-06
status: complete
commit: 0fd5d13
files_modified: [app/db.js, app/status.js, app/photos.js, app/http.js, app/routes/equipment.js, app/routes/dashboard.js, app/public/machines.js, app/public/app.js, app/public/index.html, app/public/app.css, app/scripts/smoke-test.js, app/scripts/audit-offline.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-eqs — done

**Asked for:** only admins may edit machines; a machine's status must follow its work
orders; the Machines tab only shows it; editing covers the barcode, name, manufacturer and a
photograph.

## What changed

| Piece | Before | Now |
|---|---|---|
| `equipment.status` | a field on the edit form: `active`, `down`, `retired` | stores `active` or `retired` only |
| the badge | whatever somebody last typed | derived by `app/status.js` from the work orders, with `status_reason` naming the job |
| dashboard "Machines down" | `WHERE status = 'down'`, a second opinion | the same `downMachines()` the list uses |
| `PUT /api/equipment/:id` | any signed-in user, `status` accepted | admins only; `status` must be `active`/`retired`, `down` is a 400 |
| the photograph | did not exist | file in `<data>/photos`, name chosen by the server, type from magic bytes, 2 MB cap → 413 |
| Edit / Retire / Delete | drawn for everyone | drawn only when `window.me.role === 'admin'` |
| `public/index.html` | 599 lines, styles inline | 414 lines; the stylesheet is `public/app.css` (203) |
| tests | 277 checks | **326 checks**, 0 failures, `OFFLINE-SAFE` |

### The rule, in one place

Retired outranks everything — a retired machine has left the workshop, it is not "down".
Otherwise any unfinished work order that is `high` priority **or** `in_progress` means down.
Everything else is active. `status_reason` carries the deciding job so a red badge is never
an unexplained colour, and the row is the only place the state is spelled out.

`GET /api/equipment` therefore returns `status` (derived), `service_status` (the column),
`status_reason` and `open_jobs`. The Machines screen shows the first two; nothing shows the
last one yet.

### Why the stylesheet moved

The photograph field and its preview pushed `public/index.html` from 599 to 619 lines — past
the ~600-line signal this project uses to split a file. Compacting the CSS to slip under the
limit would have been gaming the check, so the `<style>` block became `public/app.css`. The
split is a move, not a rewrite: every rule is the one that was there.

### Refusing a body without breaking the connection

The first version of the size cap called `req.destroy()` the moment the bytes passed the
limit. The 413 test then failed with `ECONNRESET`: the socket was gone before the answer
could be sent, so a browser would have shown a network error instead of "that file is too
large". `readBytes` now drains and discards past the cap — memory stays bounded at 2 MB and
the refusal is deliverable.

## Mutation proofs

Each new assertion was checked by reintroducing its defect. **14 of 14 caught.**

| Mutation | Caught by |
|---|---|
| the admin gate on `PUT` removed | *a technician cannot edit a machine* (200), *…cannot retire a machine* |
| `status: 'down'` accepted again | *a machine cannot simply be marked down*, *the refusal sends the reader to the work order* |
| `retired` stops outranking | *a retired machine reads retired, not down*, *retiring is still an administrator decision* |
| `in_progress` stops counting | *but a job somebody is working on right now does* |
| `priority` stops counting | *a high-priority job that is still open puts the machine down* (+4) |
| `status_reason` dropped | *and the list says which job did it*, *the reason names the work in progress* |
| dashboard reads the column again | *the dashboard counts the same machine as down* |
| magic-byte sniffing removed | *text sent as a JPEG is refused on its bytes* |
| size cap lifted | *a photograph over the cap is refused with 413* |
| old photo file not replaced | *leaves one file behind, not two* |
| photo not deleted with the machine | *deleting a machine deletes its photograph* |
| `admin` forced true in the client | *Edit, Retire and Delete are drawn only for an admin* |
| migration removed | *a machine left "down" by the old form is released on start-up* (+ idempotence) |
| status select restored in the dialog | *and no longer carries a status control at all* |

Two existing assertions were repaired rather than relaxed, because the change made their
old shape wrong:

* *an editing dialog is filled before it is shown* used a 600-character budget; the preview
  code pushed the call out of range. It now compares **order** inside `editEquipment`.
* *the dashboard carries no user records* scanned the payload for the word `active`, which
  the machine rows now carry as a value. It now checks **keys**, so a leaked user record is
  still caught and an honest payload is not.

A third was added because both new source-reading checks failed on a *comment* that used a
quoted `'down'`: code assertions strip comments first.

## Not verified here

The photograph in a real browser, and the technician's view in a real browser. The preview
server was driven with `curl` instead: a machine renamed and re-barcoded, `PUT status:'down'`
→ 400, a high-priority job → *down* on the list **and** on the dashboard card, closing it →
*active*, a JPEG uploaded and read back byte for byte, text sent as `image/jpeg` → 400,
`/app.css` → 200 `text/css`, and the start-up log reporting
`migrated: 1 machine status(es) now follow their work orders` against the demo database.
