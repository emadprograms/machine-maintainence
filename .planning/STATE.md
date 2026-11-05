---
gsd_state_version: '1.0'
status: milestone_closed
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 6
  completed_plans: 6
  percent: 100
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-11-05)

**Core value:** A beginner can read the entire codebase in one sitting and add a field, a page or a maintenance schedule in minutes — while the database survives crashes, reboots and power cuts intact.
**Current focus:** Milestone v1.0 closed. Phase 6 awaits a human run of `start.bat` on Windows.

## Current Position

Phase: 6 of 6 (Windows portability & offline proof) — **human_needed**
Plan: 1 of 1 complete; 5 UAT checks outstanding
Status: Milestone closed with one tracked override (see `MILESTONES.md`)
Last activity: 2026-11-05 — autonomous run completed all 6 phases; 45/45 smoke checks and offline audit green

Progress: [██████████] 100% of plans

## Evidence log

| Date | What was verified | How |
|---|---|---|
| 2026-11-05 | `node:sqlite` on Node 22.22: WAL, FK, CHECK, `VACUUM INTO` | direct `node -e` probes |
| 2026-11-05 | 45/45 smoke checks pass | `node starter/scripts/smoke-test.js` |
| 2026-11-05 | Offline-safe: no external URL, no deps, no native modules | `node starter/scripts/audit-offline.js` → `OFFLINE-SAFE` |
| 2026-11-05 | Data survives `SIGKILL` (machines, work orders, schedules) | smoke test, kill -9 then restart |
| 2026-11-05 | Reads do not write: DB mtime unchanged across 5 GETs | smoke test assertion |
| 2026-11-05 | GSD progress reads 100% (6 plans, 6 summaries) | `gsd-tools progress` |

## Bugs found and fixed during execution

| # | Bug | How it was caught | Fix |
|---|---|---|---|
| 1 | Every `GET` was unauthenticated — the guard only ran for non-GET | smoke test asserting 401 on unauthenticated read | `route(fn, opts)` + `opts.public` |
| 2 | `Object.assign(route(...))` tagged the inner handler, not the wrapper | login itself returned 401 | gave `route` a second parameter instead |
| 3 | Over-consumption surfaced `UNIQUE constraint failed` instead of a stock error | smoke test on duplicate part usage | explicit stock check + `ON CONFLICT DO UPDATE` |
| 4 | DB errors leaked raw SQL text to the user | manual probe of a bogus FK | message mapping for FK / CHECK / UNIQUE |
| 5 | `users` had no `created_at` column; user list returned 400 | smoke test on `GET /api/users` | added column + `ensureColumn` |
| 6 | Admin could disable its own account, locking the install | smoke test on `PUT /api/users/1` | `Number(id)` compare + accept `false`/`0`/`'0'` |
| 7 | Email regex rejected `tech@local`, breaking offline shops | smoke test creating a technician | permissive `local@host` rule |
| 8 | Offline audit false-positive on `http://${req.headers.host}` | first audit run | exclude template expressions (URL parsing, not a socket) |

## Decisions made during execution

| Date | Decision | Why |
|---|---|---|
| 2026-11-05 | Sessions in memory, not the database | simplest correct option; restart signs everyone out, documented as a limitation |
| 2026-11-05 | No public registration route at all | the reviewed repo's worst hole (REQ-03) |
| 2026-11-05 | `ensureColumn()` kept as the migration mechanism | proven pattern from the reviewed repo; one line per added field |
| 2026-11-05 | `.claude/` gitignored, `.planning/` committed | 16 MB of reinstallable tooling vs. the durable record |
| 2026-11-05 | Phase 6 held at `human_needed` | a `.bat` cannot be executed in a Linux sandbox; refusing to claim it works is the point |

## Open items

| Item | Type | Where |
|---|---|---|
| `start.bat` on real Windows (5 checks) | UAT | `.planning/phases/MM-06-windows-and-offline/MM-06-UAT.md` |
| `node:sqlite` is experimental in Node 22 | Risk | re-verify on Node upgrade |
| Concurrent edits are last-write-wins | Limitation | documented in `starter/README.md` |

## Blockers

None. The one open item requires hardware, not code.

## Deferred Items (acknowledged at v1.0 close)

Per GSD's `audit-open acknowledge` writer, recorded for disclosure:

| # | Category | Item | Why deferred | Where it is verified next |
|---|---|---|---|---|
| 1 | uat_gaps | `MM-06-UAT.md` — 5 pending scenarios | A `.bat` needs `cmd.exe`; this build environment is Linux | Manual run on a Windows PC, checklist already written |
| 2 | verification_gaps | `MM-06-VERIFICATION.md` — `human_needed` | Same cause: one truth (`start.bat` launches) cannot be exercised here | Same UAT |

Suppression is self-invalidating: editing the UAT or re-running verification resurfaces both.
Nothing else in the milestone was deferred.
