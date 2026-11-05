---
quick_id: 261105-rst
slug: honour-a-folder-that-survives-a-restart
date: 2026-11-05
status: in_progress
files_modified: [starter/db.js, starter/auth.js, starter/sessions.js, starter/server.js, starter/reset-password.js, starter/README.md, starter/start.bat, starter/scripts/smoke-test.js, .planning/quick/261105-rst-honour-a-folder-that-survives-a-restart/SUMMARY.md]
---

# Quick Task: a password you cannot lose, and data that survives being copied

## Context

The owner reported that the admin password changed on every restart and that the
database was wiping itself. Evidence from their machine (`LOCAL-AGENT-PROMPT.md`
report) settled it in the opposite direction: across five restarts the seed never
ran, `secret.txt` kept its original `CreationTime`, and `maintain.db` kept its
SHA256. Nothing was deleting anything.

What actually happened, in three parts:

1. **The first password is printed once and is unrecoverable.** There is no reset
   path: `PUT /api/users/:id` requires being signed in as an admin, which is the
   one thing a locked-out owner cannot do. `README.md` admitted it ("a one-line
   SQL update") and that is not a recovery path for a workshop owner.
2. **Every restart signed everybody out.** `const cookies = new Map()`
   (`server.js:15`) forgot all sessions on restart, so every restart put the
   owner back on the login screen. That reads as "the password changed again".
3. **The database was one file copy away from total loss.** WAL mode writes to
   `maintain.db-wal` and only merges on close; with no shutdown handler the merge
   never happened. Their `maintain.db` was 4,096 bytes while `maintain.db-wal`
   held 78,312 bytes. Any copy of `maintain.db` alone is an empty database. The
   folder also sat inside a git working tree that ignores it, and on a Parallels
   shared folder, where SQLite does not support WAL.

## Decisions (owner, 2026-11-05)

* Fix all of it.
* Data moves off the shared folder to the PC's own disk: `%LOCALAPPDATA%\MachineMaintenance`.
* Restarting the app must not sign anybody out.

## Plan

1. `db.js` — choose the data folder outside the app; adopt an existing
   `<app>\data` database on first run (copy, never move); add a `sessions` table;
   checkpoint the WAL after every write and on close; write the first password to
   `first-password.txt` and delete it once that account's password changes.
2. `sessions.js` (new) — sessions in the database instead of a `Map`, so they
   outlive a restart. Tokens stored hashed.
3. `server.js` — use `sessions.js`; print the absolute database path; close the
   database on SIGINT/SIGTERM; drop `first-password.txt` when `admin@local`'s
   password is changed.
4. `auth.js` — `randomPassword()` moves here and uses `randomBytes` instead of
   `Math.random`.
5. `reset-password.js` (new) — the recovery path that was missing:
   `node reset-password.js [--email …] [--password …]`, run with the app stopped.
6. `README.md`, `start.bat` — document the data location, the reset tool, the
   migration, and the fact that a plain copy of `maintain.db` is now safe.
7. `scripts/smoke-test.js` — four regression tests, each of which fails today:
   a session survives a hard restart; `maintain.db` copied alone contains
   everything; `reset-password.js` restores access; `first-password.txt` exists
   after the first run and is gone after the password changes.

## Proof required

Every new assertion must fail when its defect is reintroduced. Planned mutations:
remove the checkpoint from `run()`, put sessions back in a `Map`, skip writing
`first-password.txt`, and make `reset-password.js` a no-op.
