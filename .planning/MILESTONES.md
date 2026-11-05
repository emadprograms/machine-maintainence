# Project Milestones: Machine Maintenance (Lean Rebuild)

Entries in reverse chronological order — newest first.

## v1.0 Lean core, offline, on Windows (Shipped: 2026-11-05)

**Delivered:** A four-feature maintenance app (machines, work orders, spare parts, recurring
preventive maintenance) in ~1,040 lines of plain JavaScript with zero dependencies, replacing
`Ilop08/SIAI` after the review in `CODE_REVIEW.md`.

**Phases completed:** 6 phases, 6 plans, 22 tasks — all verified. Phase 6 verified on real
Windows 11 (Node v26.3.0) by the local agent's UAT.

**Key accomplishments:**
- Replaced sql.js's whole-file rewrite-per-request with `node:sqlite` in WAL mode, so a read never touches the disk and a write commits atomically — proven by a `SIGKILL` restart test.
- Closed all three of the reviewed repo's security holes: a per-install signing secret replaces the hardcoded one, logout revokes server-side, and no public registration route exists at all.
- Machine and work-order CRUD with real status transitions and `closed_at`, where a bogus machine id returns a readable 400 instead of a 500 leaking SQL text.
- Parts with stock and price, consumed on a job inside one transaction so the link and the decrement happen together or not at all — over-consumption is refused, never negative.
- Real recurring maintenance where the reviewed repo generated fake dates by hashing machine IDs: `pm_schedule` with `next_due`, a due-soon window that lists overdue first, and mark-done rolling forward exactly `interval_days`.
- Windows launchers plus an offline audit that proves zero external requests, verified end to end on real Windows 11 hardware rather than asserted from Linux.
- 47 automated smoke checks including a `SIGKILL` durability test, and a beginner README with two worked modification recipes.

**Stats:**
- 24 files created/modified
- ~1,040 lines of application code, ~370 lines of test code
- 6 phases, 6 plans, 22 tasks
- 1 day from start to close

**Known verification overrides:** none. The two items acknowledged earlier (the Windows UAT
and the `human_needed` verification) were resolved rather than carried: all 5 UAT scenarios
passed on Windows 11, and the run caught a real portability bug that Linux could not see —
`smoke-test.js` shelled out to `grep ... || true`, absent from `cmd.exe` (44/45 passed,
the 45th crashed). Fixed by scanning in pure JavaScript and hardening cleanup for Windows
handle-release timing; re-verified with `PATH=/nonexistent` -> **47 passed, 0 failed**.

**Git range:** `649baa0` → `4cc4c10`

**Windows evidence:** `WINDOWS_UAT_FINDINGS.md` (Windows 11, Node v26.3.0, 5/5 scenarios)

**What's next:** v1.1 — low-stock alerts, per-machine work-order history, CSV export.

---
