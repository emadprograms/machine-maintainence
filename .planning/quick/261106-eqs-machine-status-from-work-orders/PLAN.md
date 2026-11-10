---
quick_id: 261106-eqs
slug: machine-status-from-work-orders
date: 2026-11-06
status: complete
files_modified: [app/db.js, app/status.js, app/photos.js, app/http.js, app/routes/equipment.js, app/routes/dashboard.js, app/public/machines.js, app/public/index.html, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-eqs — the work order decides the machine's state

**Asked for:** only an admin may edit a machine; the machine's status must follow its work
orders rather than a field somebody forgot to update; editing covers the barcode, the name,
the manufacturer and a photograph.

## The status problem, stated plainly

Today `equipment.status` is typed into an edit form. So a machine whose job says "being
replaced" can still read *down* weeks later because nobody went back to change it, and a
machine with a live high-priority fault reads *running* because the person who reported it
did not think to edit two screens. The screen a fitter looks at is then wrong in both
directions.

**Decision:** the machine's state is computed from its work orders, and the Machines tab
only displays it.

* **retired** — an admin withdrew the machine from service. This stays a manual action
  (withdrawing a machine is not a repair) and it outranks everything: a retired machine is
  not "down", it is gone from the workshop.
* **down** — otherwise, if the machine has any work order that is not finished and is
  either **high priority** or **in progress**. A high-priority open fault means it cannot
  be trusted to run; an in-progress job means someone is working on it right now.
* **active** — otherwise.

The stored column keeps only `active` or `retired`; `down` stops being something anyone can
write. Existing rows that say `down` are migrated to `active`, because the work orders are
about to be asked instead.

Every machine now also carries **why**: `status_reason` names the job that put it down
("Replacing the drive motor (high, open)"), so the badge is never an unexplained colour.

## Edits

* **Admin only.** `PUT` and the photo routes answer 403 to a technician, and the Edit and
  Retire buttons are not drawn for one. Creating a machine and reporting a job stay open —
  a fitter must be able to say "this machine exists" — but changing what is recorded does
  not.
* **Fields:** name, **barcode** (the `asset_tag` column, relabelled — no migration needed),
  manufacturer, and a photograph, plus category, location and notes which the record
  already holds. **Status is gone from the form**, because it is no longer a field.
* **The photograph** is stored as a file beside the database, not inside it, under a name
  the server makes up. The client's filename is never used, the type is decided by sniffing
  the first bytes rather than trusting `Content-Type`, and the size is capped, because this
  is the first endpoint that accepts a file from a browser.

## Proof required

* A technician cannot edit a machine, change its status, or upload a photo (403 each).
* A machine with a high-priority open job reads down; closing that job makes it active
  again; an in-progress job also reads down; a low-priority open job does **not**.
* A retired machine with a high-priority open job still reads retired.
* `PUT` refuses `status: 'down'` with a message that names the work order as the place to
  change it.
* A photo round-trips: upload, served back with the sniffed type; a text file pretending to
  be a JPEG is refused; an oversize body is refused; the stored name is not the one the
  client sent.
* The dashboard's "Machines down" card counts the same derivation, so it cannot disagree
  with the list.
