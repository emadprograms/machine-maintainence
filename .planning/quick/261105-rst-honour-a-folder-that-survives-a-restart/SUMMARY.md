---
quick_id: 261105-rst
slug: honour-a-folder-that-survives-a-restart
date: 2026-11-05
status: complete
commit: 1d3bf71
files_modified: [starter/db.js, starter/auth.js, starter/sessions.js, starter/server.js, starter/reset-password.js, starter/README.md, starter/scripts/smoke-test.js, LOCAL-AGENT-PROMPT.md]
---

# Quick Task: a password you cannot lose, and data that survives being copied

## What the owner reported

"The admin password comes out different every time I restart, and the database is
wiping itself."

## What was actually true

Both statements were false, and proving that took the longest part of the task.

* Three restarts on one database printed the password **once**. A fresh database
  path produced a new password every time, which is correct behaviour.
* Nothing in the app deletes the database. `unlink`, `rmdir`, `DROP TABLE` and
  `TRUNCATE` do not appear in the code at all, and there is no shutdown handler of
  any kind — the program does nothing when it exits.
* A report from an agent on the owner's own Windows machine settled it: five
  restarts, and the seed never ran. `secret.txt` kept `CreationTime 11/5/2026
  6:26:57 PM` and an identical SHA256; `maintain.db` did the same. The single admin
  row still carried `created_at 2026-11-05 15:26:57`.

What the owner experienced was three separate defects wearing the same costume:

1. **The first password was unrecoverable.** Printed once to a console window, and
   the only route to a new password (`PUT /api/users/:id`) needs an admin already
   signed in. `README.md` admitted the gap: "a one-line SQL update". That is not a
   recovery path.
2. **Every restart signed everybody out.** `const cookies = new Map()` forgot all
   sessions, so each restart put them back on the login screen — which reads as
   "the password changed again".
3. **The database was one file copy from total loss.** Their `maintain.db` was
   4,096 bytes with 78,312 bytes sitting in `maintain.db-wal`, because nothing ever
   merged the side file. Any copy of `maintain.db` alone was an empty database.
   The log recorded one genuine wrong-password attempt at `16:38:25Z`, and zero
   re-seeds.

## What changed

| File | Change |
|---|---|
| `db.js` | Data folder moves to `%LOCALAPPDATA%\MachineMaintenance`; an existing `data/` is adopted on first start; `sessions` table; checkpoint after every write; `first-password.txt` written and dropped |
| `sessions.js` | New. Sessions as rows, tokens stored hashed, so a restart no longer signs you out |
| `server.js` | Uses `sessions.js`; prints the absolute database path; closes cleanly on SIGINT/SIGTERM; forgets the note when the password changes |
| `auth.js` | `randomPassword()` moved here and now uses `randomBytes` instead of `Math.random` |
| `reset-password.js` | New. The recovery path that did not exist |
| `README.md` | Where the data lives, how to get back in, and the corrected limitations |

## Proof

The suite went from 189 to 203 checks, 0 failures, run with `PATH=/nonexistent`.

| Defect reintroduced | Assertion that failed |
|---|---|
| `run()` no longer checkpoints | "a save is merged into maintain.db" (side file 251,352 bytes), "a copy of maintain.db alone still contains the data" |
| Sessions back in a process-local `Set` | "a signed-in session survives a hard restart — got 401" |
| Seed does not write `first-password.txt` | "the first password is kept beside the database — no first-password.txt" |
| Password change leaves the note behind | "changing it deletes the now-stale note" |
| `reset-password.js` reports success without writing | "the password set by reset-password.js works — Wrong email or password" |
| Upgrade copies only `maintain.db` | "the upgrade copies the side files with the database — copied: maintain.db" |

Two mutations were re-run in isolation after masking each other: removing the note
writer made the note-deletion assertion pass trivially, because no file existed to
delete.

## Known debt

`server.js` is 737 lines, against the ~600-line signal in the project rules. It was
already 714 before this task; the routes want splitting along the API groups, which
is its own change and was not folded into a bug fix.

## Verification status

Proven on Linux: 203 checks pass, and six mutations each failed their assertion.

**Not yet proven on Windows**, which is the machine it has to work on. The suite has
never run there since the change, and the `%LOCALAPPDATA%` default, the migration and
the `SIGINT` handler have never executed on that OS. `LOCAL-AGENT-VERIFY-PROMPT.md` at
the repository root is the ready-to-run check; its step 9 (copy `maintain.db` alone and
open it) is the one that matters.

## Limitations

Layout and behaviour on Windows were not exercised — the suite runs on Linux. The
`%LOCALAPPDATA%` default, the migration from an existing `data/` folder, and the
`SIGINT` handler are all reasoned rather than run. The owner's first start after
pulling this is the real test, and it prints the path it chose.
