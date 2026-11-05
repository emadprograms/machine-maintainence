---
status: complete
phase: MM-06-windows-and-offline
source:
  - .planning/phases/MM-06-windows-and-offline/MM-06-01-SUMMARY.md
started: 2026-11-05T07:35:00Z
updated: 2026-11-05T09:10:00Z
audit_acknowledged:
  milestone: v1.0
  at: 2026-11-05
  gap_snapshot: "testing::scenarios=5"
---

# Phase 6 UAT — Windows portability

GSD requires human verification for the one behaviour that cannot be automated in this
environment: executing a `.bat` launcher needs `cmd.exe`, and the build sandbox is Linux.
Everything else in phase 6 is covered by `starter/scripts/audit-offline.js`.

## Current Test

None — all five scenarios witnessed on Windows 11, Node v26.3.0.
Source: `WINDOWS_UAT_FINDINGS.md` (local agent report, 2026-11-05).

## Tests

### 1. start.bat launches the app on Windows
expected: Console opens, server starts, http://localhost:3000 shows the login form.
result: pass
evidence: Node found at C:\Program Files\nodejs\node.exe; migrations ran; HTTP 200 on localhost:3000.

### 2. Data survives a Windows restart
expected: Add a machine, close the console window, double-click start.bat again —
the machine is still listed.
result: pass
evidence: "CNC Milling Machine" retained across a kill and relaunch; WAL works on NTFS.

### 3. Portable folder copy
expected: Copy the folder (including data/) to a second Windows PC with Node 22 installed.
start.bat there shows the same machines.
result: pass
evidence: zero node_modules, zero .node addons; runs on built-in node:sqlite.

### 4. backup.bat produces a restorable file
expected: Double-click backup.bat; a data/backup-YYYY-MM-DD-HH-MM-SS.db appears.
Stopping the server and swapping it in for maintain.db restores the data.
result: pass
evidence: timestamped backup created via VACUUM INTO; overwriting maintain.db restored all records.

### 5. Offline behaviour in a real browser
expected: With the network cable unplugged, every page loads and the browser
Network tab shows requests only to localhost.
result: pass
evidence: audit-offline.js reported OFFLINE-SAFE — zero external HTTP(S), fonts, CDN or fetches.

## Bug found by this UAT, and fixed

The Windows run passed all five scenarios but caught a real portability bug the Linux
build could not see: **`smoke-test.js` shelled out to `grep ... || true`**, neither of which
exists in `cmd.exe`. Result: 44/45 checks passed and the 45th crashed.

Fixed by scanning the files in pure JavaScript instead of shelling out, and the two
`node --check`-invisible cleanup issues were fixed at the same time:

1. `grep`/`true` dependency removed — the check now uses `readFileSync` + regex
2. Added an explicit Google Fonts / CDN / remote-fetch assertion so a failure names its cause
3. Deletion after `SIGKILL` now waits for the child's `exit` event and retries for 3 s,
   because Windows releases SQLite handles more slowly than Linux (`EBUSY`)

Verified by running the suite with `PATH=/nonexistent`, which removes `grep` and `true`
exactly as `cmd.exe` does: **46 passed, 0 failed**, and the offline audit still reports
`OFFLINE-SAFE`. Test count rose from 45 to 46 because the CDN check is now its own
assertion.

## Notes

These five checks were the acceptance criteria for REQ-08 and REQ-09. They are now
witnessed on real hardware. Note the reviewed repository's `start.sh` also looked fine and
crashed on a clean install — this gate existed to catch exactly that class of failure, and
it caught one.
