# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Lean core, offline, on Windows

**Shipped:** 2026-11-05
**Phases:** 6 | **Plans:** 6 | **Tasks:** 22 | **Sessions:** 1

### What Was Built

- A four-feature maintenance app (machines, work orders, spare parts, recurring PM) in ~1,040
  lines of dependency-free JavaScript — `node:http`, `node:sqlite`, `node:crypto` and one HTML page.
- A real SQLite database in WAL mode that survives `kill -9`, replacing the reviewed repo's
  sql.js whole-file-rewrite-per-request.
- Security holes from `Ilop08/SIAI` closed and proven closed: per-install signing secret,
  server-side logout revocation, and no public registration route at all.
- 47 automated smoke checks plus an offline audit; both pass with an empty `PATH`.
- Windows launchers (`start.bat`, `backup.bat`) verified on real Windows 11 / Node 26.3.0.

### What Worked

- **Building against a written-down failure list.** The code review produced concrete findings
  with `path:line` citations, so each phase had a specific defect to kill rather than a vague
  goal. "Remove the hardcoded secret" is testable; "improve security" is not.
- **Writing the assertion before trusting the feature.** Every one of the eleven bugs fixed
  during execution was caught by something that *ran*, not by re-reading code. Four were found
  only by the test suite or the live demo.
- **GSD's digest-based staleness check.** Fixing one line in `server.js` correctly invalidated
  all six verification reports, because all six phase plans cover that file. Irritating, and
  exactly right — it prevents "verified" from silently meaning "verified four commits ago".
- **Refusing the first close.** Phase 6 sat at `human_needed` because a `.bat` cannot execute in
  a Linux sandbox. Holding it open is why the Windows run happened, and that run found a real
  portability bug that no amount of Linux testing would have surfaced.

### What Was Inefficient

- **Verification reports were written by hand.** `gsd-tools scaffold verification|uat` crashes on
  a null path, so six VERIFICATION.md files and a UAT file were composed manually, then their
  `covered_digest` fields had to be regenerated via `verification fingerprint` anyway. Hand-writing
  a machine-checked field invites staleness.
- **The task count was wrong in the shipped record.** MILESTONES.md said 24 tasks; the six PLANs
  contain 22. It survived several rounds of review because nothing recomputed it. Caught only at
  the close, by counting. Lesson: if a tool can derive a number, let it derive it.
- **Six identical "accomplishments"** were nearly archived, because the summaries had no
  one-liner and GSD fell back to each summary's first bold line. A summarisation field that
  defaults to something plausible-looking is worse than one that defaults to empty.
- **The `grep` bug existed because the suite ran where `grep` existed.** The test environment was
  more capable than the target environment, which is the classic portability blind spot.

### Patterns Established

- `route(fn, opts)` — one wrapper that requires a session on every API route and maps SQLite
  constraint errors to readable 400s. Public routes must opt out explicitly via `{ public: true }`.
- `ensureColumn()` as the whole migration mechanism: one line per added field, no framework.
- Smoke tests that start their own server on a throwaway database, then `SIGKILL` it and restart
  on the same file — the only way to prove durability rather than assume it.
- Running the suite with `PATH=/nonexistent` to approximate `cmd.exe`.
- Acknowledging a verification gap through GSD's writer rather than editing the `status:` field.

### Key Lessons

1. **A test suite that only exercises the happy path of a feature can leave the feature's most
   exposed surface untested.** The technician-403 tests covered `POST /api/users` and
   `DELETE /api/equipment`; nobody tested `GET /api/users`, and that was the leak.
2. **Click through the running product before declaring a milestone done.** Bug #11 was found
   after the close, in one manual session against the preview — not by 46 passing assertions.
3. **Derive numbers; don't retype them.** The 22-vs-24 discrepancy was invisible until the close
   because the figure lived in prose.
4. **Verify on the target platform, or say you didn't.** The Windows UAT caught what Linux could
   not; the `EBUSY` cleanup fix is still unverified on real Windows and is recorded as such.
5. **A capability difference between the test box and the target box is a bug waiting to happen.**
   Assuming `grep` exists is the same class of mistake as assuming a case-sensitive filesystem.

### Cost Observations

- Six phases executed in a single day, one session per phase.
- The dominant cost was not writing code (~1,040 lines) but verification scaffolding
  (~370 lines of test code) and the six hand-written verification reports.
- Notable: roughly half the total bug count came from tools the tests could not have predicted —
  the Windows shell, WAL handle release timing, and a role check nobody wrote a test for.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 6 | First milestone; review-driven rebuild with a Windows UAT gate |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 47 smoke checks + offline audit | Every API route; durability under `SIGKILL`; offline proof | 0 dependencies |

### Top Lessons (Verified Across Milestones)

1. Test the surface an attacker or a careless user reaches first, not the one that is easiest
   to assert on.
2. Exercise the product on its real platform before claiming it ships.
3. Let tooling derive what tooling can derive from the repository.
