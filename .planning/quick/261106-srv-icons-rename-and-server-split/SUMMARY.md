---
quick_id: 261106-srv
slug: icons-rename-and-server-split
date: 2026-11-06
status: complete
commit: abb82d9, 641059d
files_modified: [app/public/shell.js, app/server.js, app/http.js, app/values.js, app/who.js, app/routes/auth.js, app/routes/record.js, app/routes/equipment.js, app/routes/work-orders.js, app/routes/parts.js, app/routes/pm.js, app/routes/dashboard.js, app/routes/admin.js, app/routes/report.js, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md, .gitignore, and the starter/ → app/ rename itself]
---

# Quick task 261106-srv — done

**Commits:** `abb82d9` (icons, rename, split), and the review fixes that follow it.

## Icons
Assertion written first: *every screen in the sidebar has an icon* → **failed** with
`blank icons: history, report`. Two icons added (an arrow turning back, and bars over a
baseline). A second assertion catches the reverse drift — an icon key for a screen that
no longer exists — and a third refuses an icon entry with no drawing. Renaming `report:`
to `reports:` fails two of them.

## Rename
`git mv starter app`; data path is derived at runtime (`%LOCALAPPDATA%\MachineMaintenance`
on Windows, `<app>/data` on Linux), so no installation loses its database. Eleven live
documents updated; archived records untouched apart from a note.

## Split
| Before | After |
|---|---|
| `server.js` 814 | `server.js` 116 + `routes/` (9 files, 40–135 lines) + `http.js` 106 + `values.js` 54 + `who.js` 26 |

All 34 route keys present, none lost or duplicated. Six things broke during the move and
the suite caught every one — three unimported symbols and `POST /api/backup` swallowed
into `report.js` by the section split. New assertions: no application file over 600 lines,
no route file over 200.

## Review
See `.planning/CODE-REVIEW-2026-11-06.md`. One high finding: disabling a user did not end
their open session, and a role came from the token rather than the row. Fixed, with two
assertions and two mutations. Also: backup filenames collided within a second, and a role
had two spellings.

**Suite:** 240 → 250 checks, 0 failures.
