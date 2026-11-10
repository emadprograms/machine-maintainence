---
phase: 6
plan: 1
name: Windows portability & offline proof
status: complete
requirements: []
must_haves:
  - Files committed with CRLF endings
  - Script prints OFFLINE-SAFE and exits 0
  - A reader can follow either recipe without other files
---

# Plan 6-01: Windows portability & offline proof

Each task below was implemented and is covered by an assertion in
`starter/scripts/smoke-test.js` (45 checks) and, for phase 6, in
`starter/scripts/audit-offline.js`.

### Task 1: start.bat / backup.bat with CRLF pinned in .gitattributes

**Files:** `starter/start.bat`, `starter/backup.bat`, `.gitattributes`

**Acceptance:** Files committed with CRLF endings

**Status:** complete

### Task 2: Offline audit: static URL scan, runtime probe, dependency inventory

**Files:** `starter/scripts/audit-offline.js`

**Acceptance:** Script prints OFFLINE-SAFE and exits 0

**Status:** complete

### Task 3: Beginner README with worked add-a-field and add-a-table recipes

**Files:** `starter/README.md`

**Acceptance:** A reader can follow either recipe without other files

**Status:** complete

## Verification

```
node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js
-> 45 passed, 0 failed
```
