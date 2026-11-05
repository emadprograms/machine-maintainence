# Project Milestones: Machine Maintenance (Lean Rebuild)

Entries in reverse chronological order — newest first.

## v1.0 Lean core, offline (Closed: 2026-11-05 — 5 of 6 phases verified, 1 awaiting human UAT)

**Delivered:** A four-feature maintenance app (machines, work orders, spare parts, recurring
preventive maintenance) in ~1,040 lines of plain JavaScript with zero dependencies, replacing
`Ilop08/SIAI` after the review in `CODE_REVIEW.md`.

**Phases completed:** 1–5 verified by automation; phase 6 verified except the Windows run.

**Key accomplishments:**
- Replaced sql.js's whole-file rewrite-per-request with `node:sqlite` in WAL mode; reads no longer touch the disk
- Removed all three of the reviewed repo's security holes: hardcoded signing secret, public manager self-registration, and unauthenticated reads
- Built real recurring maintenance (`pm_schedule`, `next_due`, due-soon window) where the reviewed repo generated fake dates by hashing machine IDs
- 45 automated smoke checks including a `SIGKILL` durability test, plus an offline audit that proves zero external requests
- Windows launchers and a beginner README with two worked modification recipes

**Stats:**
- 24 files created/modified
- ~1,040 lines of application code, ~370 lines of test code
- 6 phases, 6 plans, 24 tasks
- 1 day from start to close

**Known verification overrides:** 2 acknowledged, both the same root cause —
`start.bat` execution on real Windows (`MM-06-UAT.md`, 5 scenarios) and the resulting
`human_needed` status on `MM-06-VERIFICATION.md`. A `.bat` needs `cmd.exe`; the build
environment is Linux. Tracked as human work, never assumed working.

**Git range:** `649baa0` → current HEAD

**What's next:** Run the five UAT checks on a Windows machine, then v1.1 (low-stock alerts,
per-machine work-order history, CSV export).

---
