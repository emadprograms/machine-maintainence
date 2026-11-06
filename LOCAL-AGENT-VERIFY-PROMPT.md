# Prompt to hand to the local agent — verifying the fix on Windows

Copy everything below the line into a local coding agent on that Windows machine. It is written to be pasted as-is. The only thing it needs from you is the app folder path, which it asks for in step 1.

---

You are verifying a bug fix on this Windows machine. The fix was written and tested on Linux and **has never run on Windows**. Your job is to prove it works here — or to prove precisely where it breaks. The engineer who wrote it is working remotely and will act on your report alone.

## Background — what was wrong

The owner of a small local web app ("Machine maintenance", plain Node.js, started with `start.bat`) reported that the admin password changed on every restart and the database was wiping itself. Evidence from this machine showed neither was happening. What was really wrong:

1. **The first password was unrecoverable.** Printed once, to a console window; the only route to a new one needs an admin who is already signed in.
2. **Every restart signed everybody out.** Sessions were a `Map` in memory, so each restart showed the login screen again.
3. **`maintain.db` alone was an empty database.** Its real content was sitting in `maintain.db-wal` (`maintain.db` 4,096 bytes, `maintain.db-wal` 78,312 bytes) because nothing ever merged the side file. Any copy of `maintain.db` — a backup, a USB stick — was empty.
4. **The data folder was inside a git working tree and git-ignored**, and on this machine inside a Parallels shared folder, where SQLite does not support WAL.

The fix introduces a password recovery tool, moves sessions into the database, merges the side file after every write, and moves the data folder to `%LOCALAPPDATA%\MachineMaintenance`, adopting the existing `data/` folder on first start.

## Ground rules — not optional

1. **Never delete, move or rename `starter\data`. Ever.** It is the migration source. Copying it is fine at any time; deleting it destroys the only copy of the current database.
2. **Do not discard local changes.** If `git status` shows modifications, stop and report them. Do not `stash`, `checkout -- .` or `reset --hard`.
3. **Do not run the app on the Mac side** or from a second copy. One machine, one instance, at a time.
4. **Do not run two copies at once**, and stop the app with **Ctrl+C in its window** — not `taskkill /F` — unless a step says otherwise. Windows cannot trap SIGTERM, so how it is stopped is part of what is being verified.
5. **Never copy `maintain.db` alone before this fix is applied** — that is trap number 3 above. After step 8 it is safe, and step 9 tests exactly that.
6. **Quote raw output** for every claim. "Looks fine" is not a result.
7. If a command fails, paste the error and continue. Do not install anything to work around it.

## Facts you will need to check against

| Thing | Expected value |
|---|---|
| App folder | `C:\Mac\Home\Documents\GitHub\machine-maintainence\starter` |
| Branch and tip | `arena/4c71aee4-machine-maintainence`, commit `724d4f7` |
| New data folder | `%LOCALAPPDATA%\MachineMaintenance` — i.e. `C:\Users\emadarshadalam\AppData\Local\MachineMaintenance` |
| Old data folder | `starter\data` — `maintain.db` 4,096 bytes, `maintain.db-wal` 78,312 bytes |
| `secret.txt` SHA256 before | `7CBA442B5C20F2A2174024935B52ABE7D8E49F633C80F2EB8A2F2A6067B6B8FE` |
| The existing account | one row: `id 1`, `admin@local`, `created_at 2026-11-05 15:26:57` |
| Test suite port | 3999 (must be free) |

## Step 1 — confirm which code is being tested

```powershell
$app = "C:\Mac\Home\Documents\GitHub\machine-maintainence"     # ask the owner to confirm
cd $app
git fetch origin
git status
git log --oneline -3
git rev-parse --abbrev-ref HEAD
node -v
[System.Environment]::OSVersion.VersionString
```

Then, if the working tree is clean:

```powershell
git checkout arena/4c71aee4-machine-maintainence
git pull origin arena/4c71aee4-machine-maintainence
git log --oneline -1
```

`HEAD` must be `724d4f7` (or a later commit on that branch). Paste the output of every command in this step. If `git status` was not clean, **stop here** and report it.

Also confirm which environment variables would redirect the data folder — they must be unset, or the migration will be skipped:

```powershell
Get-ChildItem Env: | Where-Object { $_.Name -like 'MM_*' }
```

If anything is listed, report it and stop; the app would write somewhere unexpected.

## Step 2 — snapshot before anything runs

```powershell
$data = "C:\Mac\Home\Documents\GitHub\machine-maintainence\starter\data"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = "$env:USERPROFILE\Desktop\verify-evidence-$stamp"
New-Item -ItemType Directory -Path $dest | Out-Null
Copy-Item $data -Destination "$dest\data-BEFORE" -Recurse -Force
Get-ChildItem $data -Force | Select-Object Name,Length,CreationTime,LastWriteTime |
  Format-Table -AutoSize | Out-String | Set-Content "$dest\data-listing-BEFORE.txt"
Get-FileHash "$data\secret.txt","$data\maintain.db" -Algorithm SHA256 |
  Format-List | Out-String | Set-Content "$dest\hashes-BEFORE.txt"
Get-Content "$dest\data-listing-BEFORE.txt"
Get-Content "$dest\hashes-BEFORE.txt"
Write-Output "evidence: $dest"
```

Report the folder path, the listing, and both hashes. `secret.txt` must still hash to `7CBA442B...`.

## Step 3 — run the test suite on Windows

This is the only Windows evidence that will exist, so run it before touching the real data. It starts its own server on port 3999 with a throw-away database and cleans up after itself.

```powershell
cd "$app\starter"
$env:PATH = $env:PATH
node --no-warnings=ExperimentalWarning scripts/smoke-test.js
```

Expected: **`203 passed, 0 failed`**. Paste the exact last line, and paste every `FAIL` line verbatim if there are any.

Note: this suite deletes `starter\data\login-failures.log` when it starts. That file is already in your `data-BEFORE` snapshot, so nothing is lost — just do not be surprised.

## Step 4 — the migration, before starting the app

```powershell
cd "$app\starter"
node reset-password.js
```

Three things must be true of the output. Paste all of it.

1. It mentions **adopting the existing database** from `...\starter\data` and states the new location. That location must be under `AppData\Local\MachineMaintenance`. If it is not, **stop and report** — the data folder did not move.
2. It prints `New password: <something>`.
3. It ends with `Database: C:\Users\emadarshadalam\AppData\Local\MachineMaintenance\maintain.db`.

Record that password. Then inspect the new folder:

```powershell
$new = "$env:LOCALAPPDATA\MachineMaintenance"
Get-ChildItem $new -Force | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
Get-FileHash "$new\secret.txt","$new\maintain.db" -Algorithm SHA256 | Format-List
```

Check and report:

* **All four files came across:** `maintain.db`, `maintain.db-wal`, `maintain.db-shm`, `secret.txt`. A missing `maintain.db-wal` means the migration copied an empty database.
* **`secret.txt` hash is unchanged** and still `7CBA442B...`.
* **`maintain.db` is larger than 4,096 bytes** now, because the side file was folded in when the copy was opened.

Then prove the account came across, using this script. Save it as `readdb.mjs` **outside** the app folder, e.g. on the Desktop:

```js
// readdb.mjs — read-only inspection. Usage: node readdb.mjs <path to .db>
import { DatabaseSync } from 'node:sqlite';
import { existsSync, statSync } from 'node:fs';

const path = process.argv[2];
for (const p of [path, path + '-wal', path + '-shm']) {
  console.log(p, existsSync(p) ? statSync(p).size + ' bytes' : 'ABSENT');
}
const db = new DatabaseSync(path, { readOnly: true });
for (const t of ['users', 'equipment', 'work_orders', 'parts', 'pm_schedule']) {
  try { console.log(t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n); }
  catch (e) { console.log(t, 'ERROR:', e.message); }
}
for (const u of db.prepare('SELECT id,name,email,role,active,created_at FROM users').all()) {
  console.log('user', JSON.stringify(u));
}
db.close();
```

```powershell
node --no-warnings=ExperimentalWarning "$env:USERPROFILE\Desktop\readdb.mjs" "$env:LOCALAPPDATA\MachineMaintenance\maintain.db"
```

**The decisive check:** there must be exactly one user, `admin@local`, with `created_at":"2026-11-05 15:26:57"` — the same row from before the fix. If that timestamp changed, the migration did not carry the real database and **everything after this point is meaningless**. Stop and report.

## Step 5 — confirm the old folder is untouched

```powershell
Get-ChildItem $data -Force | Select-Object Name,Length,CreationTime,LastWriteTime | Format-Table -AutoSize
```

`maintain.db`, `maintain.db-wal` and `secret.txt` should still be there, with CreationTimes from `11/5/2026`, and `maintain.db` still 4,096 bytes. The migration copies; it does not move.

## Step 6 — start it the way the owner starts it

Double-click `start.bat`. Read the console window (or select all and copy). Paste what it says. It must contain:

* `Database: C:\Users\emadarshadalam\AppData\Local\MachineMaintenance\maintain.db` — **not** `data/maintain.db`
* `Stop it with Ctrl+C in this window.`
* **No `Created the first account` block.** If a password is printed here, the app did not find the migrated database — stop and report immediately.

Log in at `http://localhost:3000` with `admin@local` and the password from step 4. Report whether the dashboard loads and what it shows.

Create one machine named exactly `WINDOWS-VERIFY`.

## Step 7 — the side file must not grow

With the app still running, in PowerShell:

```powershell
$new = "$env:LOCALAPPDATA\MachineMaintenance"
Get-ChildItem $new -Force | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
Get-ChildItem $data -Force | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
```

* `maintain.db-wal` must be **0 bytes** (or absent entirely), because every save now merges it. A large `-wal` means the checkpoint is not running on Windows.
* `maintain.db` should now be bigger than it was after step 4.
* The files in `starter\data` must be **unchanged, still dated 11/5/2026** — proof the app is no longer writing there.

## Step 8 — stop it properly

Click the console window and press **Ctrl+C**. Expect a line `Closing the database.` and then the `pause` prompt. Paste the last lines of the window, and report whether `Closing the database.` appeared.

## Step 9 — copy `maintain.db` alone (the whole point)

With the app stopped:

```powershell
Copy-Item "$env:LOCALAPPDATA\MachineMaintenance\maintain.db" "$env:USERPROFILE\Desktop\copy-alone.db" -Force
node --no-warnings=ExperimentalWarning "$env:USERPROFILE\Desktop\readdb.mjs" "$env:USERPROFILE\Desktop\copy-alone.db"
```

This must show **1 user and 1 equipment row named `WINDOWS-VERIFY`**, with `-wal` and `-shm` reported as ABSENT and the file opening cleanly. **An empty database here is a failure of the entire fix** — it is the exact defect the owner hit. Say so plainly if it happens.

## Step 10 — restart, and check you are still signed in

Start `start.bat` again, then **without logging in**, reload `http://localhost:3000` in the browser.

* The dashboard should load. Report what happens.
* If you land on the login screen, sessions did not survive the restart on Windows — report that as a failure of fix 2, and say whether the machine `WINDOWS-VERIFY` is still visible after logging in.

Also confirm no password was printed in the console this time.

## Step 11 — the recovery tool, used for real

Stop the app with Ctrl+C. Then:

```powershell
cd "$app\starter"
node reset-password.js --password WindowsTest2026
```

Start it again and log in with `admin@local` / `WindowsTest2026`. Report whether that works. This is the tool the owner depends on if they lose the password again, so a failure here matters more than a failure anywhere else.

## Step 12 — where a failed login is recorded

Log out, then attempt one login with a deliberately wrong password. Then:

```powershell
Get-ChildItem "$env:LOCALAPPDATA\MachineMaintenance" -Force | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
```

`login-failures.log` must appear in `%LOCALAPPDATA%\MachineMaintenance` (not in `starter\data`). Report the newest line and whether it records a source address.

Finally, stop the app with Ctrl+C and leave it stopped.

## Report format — your answer must contain exactly these sections

1. **Verdict** — one of: the fix works on Windows; it works except for (specific part); or it fails, with which of the four fixes failed. State your confidence.
2. **Step 1 output** — branch, commit, `node -v`, Windows version, and whether `MM_*` variables were set.
3. **Suite result on Windows** — the final `passed/failed` line, plus any `FAIL` lines verbatim.
4. **Migration** — the full output of `node reset-password.js`, the listing of `%LOCALAPPDATA%\MachineMaintenance`, both `secret.txt` hashes (must match `7CBA442B...`), and the `readdb.mjs` output including every user row with its `created_at`.
5. **Old folder untouched** — the listing of `starter\data` from step 5, and again from step 7, so the two can be compared.
6. **First start** — the console text from step 6, especially the `Database:` line, and whether a password block appeared.
7. **Side file** — byte sizes of `maintain.db` and `maintain.db-wal` at steps 4, 7 and 9, so growth is visible.
8. **Copy-alone result** — the `readdb.mjs` output for the Desktop copy, verbatim.
9. **Sessions after restart** — what the browser did on reload without logging in.
10. **Recovery tool** — whether `reset-password.js --password WindowsTest2026` let you sign in.
11. **Anything unexpected**, even if it looks unrelated. Unsorted observations beat a tidy story.
12. **Path to the evidence folder** from step 2.

Do not fix anything, do not edit any file, and do not tell the owner it works unless the section 8 copy-alone check passed. Report what you found.
