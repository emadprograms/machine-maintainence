# Project Milestones: Machine Maintenance (Lean Rebuild)

Entries in reverse chronological order — newest first.

## v1.0 Lean core, offline (Shipped: 2026-11-05 — all 6 phases verified)

**Delivered:** A four-feature maintenance app (machines, work orders, spare parts, recurring
preventive maintenance) in ~1,040 lines of plain JavaScript with zero dependencies, replacing
`Ilop08/SIAI` after the review in `CODE_REVIEW.md`.

**Phases completed:** 1–6, all verified. Phase 6 verified on real Windows 11 (Node v26.3.0) by the local agent's UAT.

**Key accomplishments:**
- Replaced sql.js's whole-file rewrite-per-request with `node:sqlite` in WAL mode; reads no longer touch the disk
- Removed all three of the reviewed repo's security holes: hardcoded signing secret, public manager self-registration, and unauthenticated reads
- Built real recurring maintenance (`pm_schedule`, `next_due`, due-soon window) where the reviewed repo generated fake dates by hashing machine IDs
- 47 automated smoke checks including a `SIGKILL` durability test, plus an offline audit that proves zero external requests
- Windows launchers and a beginner README with two worked modification recipes

**Stats:**
- 24 files created/modified
- ~1,040 lines of application code, ~370 lines of test code
- 6 phases, 6 plans, 24 tasks
- 1 day from start to close

**Known verification overrides:** none. The two items acknowledged earlier (the Windows UAT
and the `human_needed` verification) were resolved rather than carried: all 5 UAT scenarios
passed on Windows 11, and the run caught a real portability bug that Linux could not see —
`smoke-test.js` shelled out to `grep ... || true`, absent from `cmd.exe` (44/45 passed,
the 45th crashed). Fixed by scanning in pure JavaScript and hardening cleanup for Windows
handle-release timing; re-verified with `PATH=/nonexistent` -> **47 passed, 0 failed**.

**Git range:** `649baa0` → current HEAD

**Windows evidence:** `WINDOWS_UAT_FINDINGS.md` (Windows 11, Node v26.3.0, 5/5 scenarios)

**What's next:** v1.1 — low-stock alerts, per-machine work-order history, CSV export.

---
