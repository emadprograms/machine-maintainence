# Prompt to hand to the local agent

Copy everything below the line into a local coding agent (Claude Code, Cursor, Codex, Copilot agent — anything with shell access on that Windows machine). It is written to be pasted as-is.

---

You are investigating a data-persistence bug on this Windows machine. Your job is **evidence collection only** — not fixing. Another engineer is diagnosing remotely and will act on your report, so anything you leave out is a dead end for them.

## The symptom

A small local web app ("Machine maintenance") is started by double-clicking `start.bat`. On **every restart it prints a brand-new admin password** and the previous password stops working. The owner believes their data is being deleted on shutdown.

## Ground rules — read these first, they are not optional

1. **Read-only investigation.** Do not edit, rename, delete, move, or "clean up" any file of the app, its `data` folder, or any copy of it. Do not change `start.bat`. Do not reinstall or re-extract anything. Do not run the app with a different database path.
2. **Preserve evidence before touching anything.** Phase 0 is a snapshot. Do it first.
3. **Never open the real database with a tool while the app is running**, and never record file sizes *after* opening it — opening a SQLite database with a `-wal` file next to it merges the `-wal` into the main file and changes its size and contents. That will corrupt the measurements. Order is always: **stop the app → record file listing → then read the database.**
4. **Never copy `maintain.db` by itself.** If a copy is needed, copy `maintain.db`, `maintain.db-wal` and `maintain.db-shm` together, or use the app's own `backup.bat`.
5. **Stop the app the way the owner stops it** (normally closing the window / Ctrl+C), not with `taskkill /F`, unless a step explicitly says otherwise. How it is stopped is part of the evidence.
6. **Quote raw output.** For every claim, paste the actual command output in a fenced block. Do not summarise output as "looks fine".
7. If a command fails (missing tool, permissions, path), **paste the error** and continue to the next step. Do not install anything to work around a failure.

## Facts about the app — so you do not have to guess

- It is plain Node.js. **There is no `package.json` and no `node_modules`.** Nothing to `npm install`.
- Files: `server.js`, `db.js`, `auth.js`, `login-log.js`, `start.bat`, `backup.bat`, `public/`, `scripts/`, `data/`.
- Database: SQLite via Node's built-in `node:sqlite`, in WAL mode. Default location `data\maintain.db` — **relative to the app folder**, not an absolute path stored anywhere.
- `data\` also holds `secret.txt` (the login signing key, created once and never rewritten) and possibly `login-failures.log`.
- Default port **3000**, binds `0.0.0.0`.
- `start.bat` is:
  ```bat
  cd /d "%~dp0"
  node --no-warnings=ExperimentalWarning server.js
  ```
  So the app's home is **whichever folder `start.bat` sits in when it is run**, and any Windows shortcut supplies its own working folder.
- The first-run message is printed **only when the `users` table has zero rows**. Its exact text is:
  ```
    Created the first account:
      email:    admin@local
      password: <something>
    Write it down now — it is not shown again.
  ```
  Seeing that block again on a restart means the app concluded "zero accounts exist right now".
- Tables: `users`, `equipment`, `work_orders`, `parts`, `work_order_parts`, `pm_schedule`.
- Nothing in the app's code deletes the database, and the app has **no shutdown handler at all**.

## Phase 0 — snapshot the evidence (do this before anything else)

Stop the app if it is running. Then, in PowerShell, with the app folder path filled in:

```powershell
$app = "C:\FULL\PATH\TO\starter"      # <-- replace with the real path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = "$env:USERPROFILE\Desktop\app-evidence-$stamp"
New-Item -ItemType Directory -Path $dest | Out-Null
Copy-Item "$app\data" -Destination "$dest\data-snapshot" -Recurse -Force
Copy-Item "$app\start.bat","$app\backup.bat","$app\db.js","$app\server.js" -Destination $dest -Force
Get-ChildItem "$app\data" -Force | Select-Object Name,Length,CreationTime,LastWriteTime | Format-Table -AutoSize | Out-String | Set-Content "$dest\data-listing-BEFORE-anything.txt"
Write-Output "Evidence saved to $dest"
Get-Content "$dest\data-listing-BEFORE-anything.txt"
```

Report: the folder `$dest`, the listing it printed, and the full contents of the `data` folder including hidden files. State explicitly whether `maintain.db-wal` and `maintain.db-shm` exist right now.

## Phase 1 — establish exactly where the app runs from

1. Node version and Windows version:
   ```powershell
   node -v
   [System.Environment]::OSVersion.VersionString
   $PSVersionTable.PSVersion.ToString()
   ```
2. The real, full path of the app folder and every file in it with timestamps:
   ```powershell
   Get-ChildItem $app -Force | Select-Object Mode,Length,CreationTime,LastWriteTime,Name | Format-Table -AutoSize
   ```
3. **Is there more than one copy of the app on this machine?** This matters enormously — two copies each have their own private database and look exactly like data loss to the owner.
   ```powershell
   Get-ChildItem C:\ -Recurse -Include maintain.db,secret.txt,start.bat -ErrorAction SilentlyContinue |
     Where-Object { $_.FullName -match 'maintain|starter|machin' } |
     Select-Object FullName,Length,CreationTime,LastWriteTime | Format-Table -AutoSize
   ```
   (This is slow. Let it finish, and paste all of it. If it produces nothing, also try other drives, e.g. `D:\`.)
4. **How is it launched?** Ask the owner, and also check:
   - Desktop/Start Menu shortcuts that point at `start.bat` or `node.exe` — the shortcut's **"Start in"** folder is the app's home:
     ```powershell
     $sh = New-Object -ComObject WScript.Shell
     Get-ChildItem "$env:USERPROFILE\Desktop","$env:APPDATA\Microsoft\Windows\Start Menu","$env:ProgramData\Microsoft\Windows\Start Menu" -Recurse -Filter *.lnk -ErrorAction SilentlyContinue |
       ForEach-Object { $l = $sh.CreateShortcut($_.FullName)
         [pscustomobject]@{ Shortcut=$_.FullName; Target=$l.TargetPath; StartIn=$l.WorkingDirectory; Args=$l.Arguments } } |
       Format-List
     ```
   - Scheduled tasks:
     ```powershell
     Get-ScheduledTask | Where-Object { $_.Actions.Execute -match 'node|cmd|start\.bat' -or $_.Actions.Arguments -match 'server\.js|start\.bat' } |
       ForEach-Object { $_.TaskName; $_.Actions | Format-List Execute,Arguments,WorkingDirectory; (Get-ScheduledTaskInfo $_.TaskName) | Format-List LastRunTime,LastTaskResult,NumberOfMissedRuns }
     ```
   - Services:
     ```powershell
     Get-CimInstance Win32_Service | Where-Object { $_.PathName -match 'node|maintain|starter' } | Select-Object Name,State,StartMode,PathName | Format-List
     ```
   - Anything in the Startup folders and Run keys:
     ```powershell
     Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup","$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Startup" -Force -ErrorAction SilentlyContinue
     Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run","HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -ErrorAction SilentlyContinue
     ```
5. Is anything running right now, and with what command line?
   ```powershell
   Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' } | Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine | Format-List
   ```
6. Flag, in plain words, whether the app path is inside any of these risky locations: `%TEMP%` / `AppData\Local\Temp`, `Downloads`, a OneDrive/Dropbox/Google Drive folder, a network/mapped drive, `Program Files`, a folder whose name suggests an extracted zip (`...\starter (1)`, `...\starter-extracted`). Check with:
   ```powershell
   Write-Output "TEMP=$env:TEMP"
   Get-Volume | Format-Table DriveLetter,FileSystemLabel,DriveType,SizeRemaining,Size -AutoSize
   net use
   ```

## Phase 2 — the restart test (the core of the investigation)

Do **5 restarts**, and record one row per restart. To capture the console text reliably rather than trying to select it by hand, start the app from a `cmd` window like this each time:

```bat
cd /d "C:\FULL\PATH\TO\starter"
node --no-warnings=ExperimentalWarning server.js > restart-1.txt 2>&1
```

But **first** do one restart the owner's own normal way (double-click / shortcut), and note whether the password changed then too. The bug must be reproduced the way they actually use it.

Between each restart, stop the app normally (Ctrl+C, or closing the window). Then record, **before starting the next one**:

```powershell
Get-ChildItem "$app\data" -Force |
  Select-Object Name,Length,CreationTime,LastWriteTime |
  Sort-Object Name | Format-Table -AutoSize
Get-FileHash "$app\data\secret.txt" -Algorithm SHA256 -ErrorAction SilentlyContinue
Get-FileHash "$app\data\maintain.db" -Algorithm SHA256 -ErrorAction SilentlyContinue
```

Build this table and fill every cell, for all 5 restarts:

| Restart | Time | Did "Created the first account" appear? | Password printed | `secret.txt` CreationTime | `secret.txt` SHA256 | `maintain.db` CreationTime | `maintain.db` Length | `-wal` present? `-wal` size | Login with the previous password worked? |
|---|---|---|---|---|---|---|---|---|---|

The single most decisive cell in that table is **`secret.txt` CreationTime**.

- If `secret.txt` gets a **new CreationTime** each restart, the entire `data` folder is being recreated — something outside the app is replacing the app folder.
- If `secret.txt` **keeps its original CreationTime** and only `maintain.db` is new or smaller, then something is removing the database specifically, and the app folder is stable.
- If `secret.txt` keeps its CreationTime **and** `maintain.db` also keeps its CreationTime and hash, yet a new password is still printed, then the app is reading a *different* database and the problem is the launch folder, not the file.

Also paste each `restart-N.txt` console output in full (it is short — it prints the URL and possibly the first-account block).

## Phase 3 — what is actually inside the database right now

**Stop the app first.** Then record the file listing (sizes/timestamps), and only after that read the contents. Save this as `readdb.mjs` in a scratch folder (not inside the app folder) and run it from the app folder so the relative path resolves:

```js
// readdb.mjs — read-only inspection of the app database
import { DatabaseSync } from 'node:sqlite';
import { existsSync, statSync } from 'node:fs';

const path = process.argv[2] || 'data/maintain.db';
for (const p of [path, path + '-wal', path + '-shm']) {
  console.log(p, existsSync(p) ? statSync(p).size + ' bytes' : 'ABSENT');
}
const db = new DatabaseSync(path, { readOnly: true });
for (const t of ['users', 'equipment', 'work_orders', 'parts', 'work_order_parts', 'pm_schedule']) {
  try {
    console.log(t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n);
  } catch (e) {
    console.log(t, 'ERROR:', e.message);
  }
}
try {
  console.log('\nusers:');
  for (const u of db.prepare('SELECT id,name,email,role,active,created_at FROM users ORDER BY id').all()) {
    console.log(' ', JSON.stringify(u));
  }
} catch (e) { console.log('users ERROR:', e.message); }
db.close();
```

Run it and paste everything:

```bat
cd /d "C:\FULL\PATH\TO\starter"
node --no-warnings=ExperimentalWarning readdb.mjs data\maintain.db
```

Interpretation, state which applies in your report:

- **Rows in `equipment` / `work_orders` > 0** → the data was never lost. The owner's work is intact and only the admin account is being recreated.
- **All tables at 0, `users` containing exactly one `admin@local` with a fresh `created_at`** → this really is an empty, newly created database.
- **Several `admin@local`-like rows, or an old `created_at` alongside a new one** → accounts are accumulating; the login is pointing at an older database.
- Report the `created_at` values in full — comparing them to the restart times in Phase 2 tells us whether you are looking at the *same* database between restarts or a new one.

## Phase 4 — rule out the surrounding Windows machinery

1. **OneDrive / cloud sync on the app folder:**
   ```powershell
   Get-Process OneDrive -ErrorAction SilentlyContinue | Select-Object Id,StartTime
   Get-Item "$app\data\maintain.db" | Select-Object -ExpandProperty Attributes
   ```
   An attribute containing `Offline`/`RecallOnDataAccess` means Files On-Demand cloud placeholders.
2. **Defender Controlled Folder Access** — this can silently block an app from writing to Documents/Desktop:
   ```powershell
   Get-MpPreference | Select-Object EnableControlledFolderAccess,ControlledFolderAccessProtectedFolders,ControlledFolderAccessAllowedApplications
   Get-MpComputerStatus | Select-Object AntivirusEnabled,RealTimeProtectionEnabled
   Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'; Id=1123,1124} -MaxEvents 20 -ErrorAction SilentlyContinue |
     Select-Object TimeCreated,Id,Message | Format-List
   ```
3. **Anything that cleans temp folders automatically** (Storage Sense), which would explain a `%TEMP%` home:
   ```powershell
   Get-ScheduledTask -TaskName "*StorageSense*","*SilentCleanup*" -ErrorAction SilentlyContinue | Select-Object TaskName,State
   Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\StorageSense\Parameters\StoragePolicy" -ErrorAction SilentlyContinue
   ```
4. **Did the files get touched by a sync/backup tool?** Recent activity in the app folder:
   ```powershell
   Get-ChildItem "$app" -Recurse -Force | Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-14) } | Select-Object LastWriteTime,Length,FullName | Sort-Object LastWriteTime
   ```
5. **Disk health**, briefly, so a failing disk is not left as an unknown:
   ```powershell
   Get-PhysicalDisk | Select-Object FriendlyName,MediaType,HealthStatus,OperationalStatus
   Get-Volume | Select-Object DriveLetter,HealthStatus,SizeRemaining
   ```

## Phase 5 — one optional controlled experiment

Only if the owner agrees, because it temporarily moves their real database:

1. Stop the app. Copy (do not move) `data` to the Desktop as `data-backup-manual`.
2. Start the app, log in, create a machine named `PERSISTENCE-TEST`, stop the app normally.
3. Record the file listing and `secret.txt` / `maintain.db` hashes.
4. **Make a desktop shortcut to `start.bat`, then edit that shortcut's "Start in" field to a different folder** (e.g. `C:\Windows\Temp\probe`) and launch the app through that shortcut.
5. Note whether a new password is printed and whether `PERSISTENCE-TEST` is visible.

This distinguishes "the app folder is being replaced" from "the launch working folder is wrong" — the two remaining causes. If you cannot edit a shortcut's Start-in, say so and skip the step; do not improvise a different experiment.

## Report format — your answer must contain exactly these sections

1. **Verdict** — one of: (a) the app folder or its `data` folder is being recreated; (b) the database file alone is being removed/replaced; (c) the app is launched from a different folder each time and reads a different database; (d) the data is intact and only the admin account is being recreated; (e) none of the above, with what you saw instead. State your confidence and the single observation that decides it.
2. **The Phase 2 table**, fully filled in, plus the raw console text of all 5 restarts.
3. **`secret.txt` behaviour across restarts** — CreationTime identical or not. Quote the actual timestamps. This is the key evidence; do not omit or paraphrase it.
4. **Database contents** — the raw `readdb.mjs` output, including `created_at` values.
5. **Where the app runs from** — full path, number of copies found, every launcher (shortcut with Target and Start-in, scheduled task with WorkingDirectory, service `PathName`), and whether the path is in any risky location from Phase 1 step 6.
6. **What was ruled out** — OneDrive, Controlled Folder Access, Storage Sense, disk health, multiple node processes. One line each, with the command output that justifies it.
7. **The exact `data` folder listings** from every step where you recorded one, in order, with timestamps.
8. **Anything surprising**, even if it seems unrelated. Unsorted observations are more useful than a tidy story.
9. **Path to the evidence folder** you created in Phase 0, so it can be shared.

Do not propose a fix, do not change any code, and do not tell the owner it is fixed. Report what you found.
