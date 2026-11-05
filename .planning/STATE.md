---
gsd_state_version: '1.0'
status: executing
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 16
  completed_plans: 12
  percent: 75
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-11-05)

**Core value:** A beginner can read the entire codebase in one sitting and add a field, a page or a maintenance schedule in minutes — while the database survives crashes, reboots and power cuts intact.
**Current focus:** Phase 6 — Windows portability & offline proof

## Current Position

Phase: 6 of 6 (Windows portability & offline proof)
Plan: 1 of 3 in current phase
Status: In progress — scaffold complete and smoke-tested, Windows `.bat` written but unverified on real hardware
Last activity: 2026-11-05 — wrote `starter/`, fixed 2 auth bugs, reached 33/33 smoke tests

Progress: [██████████░░░░] 75%

## Evidence log

| Date | What was verified | How |
|---|---|---|
| 2026-11-05 | `node:sqlite` available on Node 22.22 with no flags | `node -e` probe; WAL, FK, CHECK, `VACUUM INTO` all confirmed |
| 2026-11-05 | 33/33 smoke checks pass, including `kill -9` restart and no-rewrite-on-GET | `node scripts/smoke-test.js` → `33 passed, 0 failed` |
| 2026-11-05 | Bug: every GET was unauthenticated (guard only ran for non-GET) | fixed in `server.js` `route()` — `opts.public` |
| 2026-11-05 | Bug: `Object.assign(route(...))` tagged the inner fn, not the wrapper | fixed by giving `route(fn, opts)` a second parameter |
| 2026-11-05 | Bug: over-consuming stock returned a UNIQUE error instead of a stock error | fixed with explicit stock check + `ON CONFLICT DO UPDATE` |
| 2026-11-05 | Bug: DB errors leaked SQL text to the user | fixed with FOREIGN KEY / CHECK / UNIQUE message mapping |

## Decisions made during execution

| Date | Decision | Why |
|---|---|---|
| 2026-11-05 | Session in `cookies` Map (memory), not the DB | simplest correct thing; restart signs everyone out, documented as a limitation |
| 2026-11-05 | No public registration endpoint at all | the reviewed repo's worst security hole (REQ-03) |
| 2026-11-05 | `ensureColumn()` kept as the migration mechanism | proven pattern from the reviewed repo; one line per added field |

## Open questions / risks

- **Windows untested.** `.bat` files are CRLF and syntax-checked by inspection only. Needs a real Windows run (Phase 6 criterion 1).
- **`node:sqlite` experimental status.** Pinned to Node 22 behaviour; verify on any Node upgrade.
- **Concurrency.** Single-process, in-memory session store. Two people editing the same work order will last-write-wins. Acceptable for one workshop; note it in the README.

## Blockers

None.

## Next step

Phase 6, plan 06-01: verify `start.bat` on Windows, then finish the offline audit script.
