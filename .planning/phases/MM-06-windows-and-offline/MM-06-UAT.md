---
status: testing
phase: MM-06-windows-and-offline
source:
  - .planning/phases/MM-06-windows-and-offline/MM-06-01-SUMMARY.md
started: 2026-11-05T07:35:00Z
updated: 2026-11-05T07:35:00Z
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

number: 1
name: start.bat launches the app on Windows
expected: |
  Double-clicking start.bat opens a console window, prints
  "Machine maintenance running at http://localhost:3000", and the browser
  reaches the login form. No "Node.js is not installed" message.
awaiting: user response

## Tests

### 1. start.bat launches the app on Windows
expected: Console opens, server starts, http://localhost:3000 shows the login form.
result: pending

### 2. Data survives a Windows restart
expected: Add a machine, close the console window, double-click start.bat again —
the machine is still listed.
result: pending

### 3. Portable folder copy
expected: Copy the folder (including data/) to a second Windows PC with Node 22 installed.
start.bat there shows the same machines.
result: pending

### 4. backup.bat produces a restorable file
expected: Double-click backup.bat; a data/backup-YYYY-MM-DD-HH-MM-SS.db appears.
Stopping the server and swapping it in for maintain.db restores the data.
result: pending

### 5. Offline behaviour in a real browser
expected: With the network cable unplugged, every page loads and the browser
Network tab shows requests only to localhost.
result: pending

## Notes

These five checks are the acceptance criteria for REQ-08 and REQ-09. Until they are
witnessed on real hardware, phase 6 stays `human_needed` rather than `passed` — that is
deliberate: the reviewed repository's `start.sh` also looked fine and crashed on a clean
install, which is exactly the failure this gate exists to catch.
