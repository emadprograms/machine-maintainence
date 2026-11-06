---
gsd_state_version: "1.0"
milestone: v3.0
milestone_name: The record
status: In progress
last_updated: "2026-11-05T15:16:52.889Z"
last_activity: 2026-11-06
last_activity_desc: v3.0 phase 14 (the record) complete
state_head: 5b8efcd03c86601ea1feca8f8f62811dd7831bea
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 3
  completed_plans: 1
  percent: 33
current_phase: 14
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-11-05)

**Core value:** A beginner can read the entire codebase in one sitting and add a field, a page or a maintenance schedule in minutes — while the database survives crashes, reboots and power cuts intact.
**Current focus:** v3.0 "The record" — history, search and cost. v1.0, v1.1 and v2.0 are closed and archived.

## Current Position

Phase: 14 — The record (complete)
Plan: —
Status: In progress: v3.0, phases 15 and 16 remain
Last activity: 2026-11-05 — Milestone v2.0 completed and archived

## Quick Tasks Completed

| Date | ID | Task | Commit |
|---|---|---|---|
| 2026-11-05 | 261105-kkb | Record failed sign-ins instead of blocking them; amended the record to match | `dd6b44e`, `23bf79f` |
| 2026-11-05 | 261105-rst | Stop the password lockout: keep the first password, keep sessions across a restart, keep `maintain.db` copyable, move data out of the app folder | `1d3bf71` |

## Evidence log

| Date | What was verified | How |
|---|---|---|
| 2026-11-05 | `node:sqlite` on Node 22.22: WAL, FK, CHECK, `VACUUM INTO` | direct `node -e` probes |
| 2026-11-05 | Five restarts do not re-seed; `secret.txt` and `maintain.db` keep CreationTime and SHA256; a `.db` copy alone was empty (4,096 B vs 78,312 B of `-wal`) | an evidence-collection agent on the owner's Windows machine, prompt in `LOCAL-AGENT-PROMPT.md` |
| 2026-11-05 | Six mutations of the persistence fixes each failed their assertion | `scripts/smoke-test.js`, 203 checks |
| 2026-11-05 | 45/45 smoke checks pass | `node starter/scripts/smoke-test.js` |
| 2026-11-05 | Offline-safe: no external URL, no deps, no native modules | `node starter/scripts/audit-offline.js` → `OFFLINE-SAFE` |
| 2026-11-05 | Data survives `SIGKILL` (machines, work orders, schedules) | smoke test, kill -9 then restart |
| 2026-11-05 | Reads do not write: DB mtime unchanged across 5 GETs | smoke test assertion |
| 2026-11-05 | GSD progress reads 100% (6 plans, 6 summaries) | `gsd-tools progress` |
| 2026-11-05 | Windows 11 / Node v26.3.0: all 5 Phase 6 UAT scenarios pass | local agent, `WINDOWS_UAT_FINDINGS.md` |
| 2026-11-05 | Smoke test passes with `PATH=/nonexistent` (no `grep`, no `true`) | 47 passed, 0 failed |
| 2026-11-05 | Offline audit OFFLINE-SAFE with empty PATH | `audit-offline.js` |

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
| 9 | `smoke-test.js` shelled out to `grep ... \|\| true` — neither exists in `cmd.exe`; 44/45 then crash | Windows UAT (local agent) | pure-JavaScript file scan; added an explicit CDN/font assertion |
| 10 | Deleting the temp DB right after `SIGKILL` can throw `EBUSY` on Windows | Windows UAT follow-up | wait for the child's `exit` event, then retry deletes for 3 s |
| 11 | `GET /api/users` had no role check — a technician could read the whole staff list (names, emails, roles) | post-ship click-through of the running app | added the same `role !== 'admin'` guard `POST`/`PUT` already had, plus a smoke assertion for the read |

## Decisions made during execution

| Date | Decision | Why |
|---|---|---|
| 2026-11-05 | Sessions in memory, not the database | simplest correct option; restart signs everyone out, documented as a limitation |
| 2026-11-06 | ~~Sessions in memory~~ reversed: sessions are rows in the `sessions` table | the memory store made every restart look like "the password changed again"; see quick task `261105-rst` |
| 2026-11-06 | Data folder moves to `%LOCALAPPDATA%\MachineMaintenance` | it was inside the git working tree (gitignored) and on a Parallels shared folder, where SQLite does not support WAL |
| 2026-11-05 | No public registration route at all | the reviewed repo's worst hole (REQ-03) |
| 2026-11-05 | `ensureColumn()` kept as the migration mechanism | proven pattern from the reviewed repo; one line per added field |
| 2026-11-05 | `.claude/` gitignored, `.planning/` committed | 16 MB of reinstallable tooling vs. the durable record |
| 2026-11-05 | Phase 6 held at `human_needed` | a `.bat` cannot be executed in a Linux sandbox; refusing to claim it works is the point |

## Open items

| Item | Type | Where |
|---|---|---|
| The persistence fix (`261105-rst`) is proven on Linux only — 203 checks, 6 mutations | Pending | hand `LOCAL-AGENT-VERIFY-PROMPT.md` to an agent on the Windows machine |
| | `node:sqlite` is experimental in Node 22 (worked on Node 26.3.0) | Risk | re-verify on Node upgrade |
| Concurrent edits are last-write-wins | Limitation | documented in `starter/README.md` |

## Blockers

None. Milestone shipped.

## Deferred Items (from the v1.0 close — all resolved)

Both items below were acknowledged at the earlier close attempt and have since been
**resolved** by the Windows UAT, not carried forward. `audit-open` now reports all clear
with zero suppressed items.

Per GSD's `audit-open acknowledge` writer, recorded for disclosure:

| # | Category | Item | Why deferred | Where it is verified next |
|---|---|---|---|---|
| 1 | uat_gaps | `MM-06-UAT.md` — 5 pending scenarios | A `.bat` needs `cmd.exe`; this build environment is Linux | Manual run on a Windows PC, checklist already written |
| 2 | verification_gaps | `MM-06-VERIFICATION.md` — `human_needed` | Same cause: one truth (`start.bat` launches) cannot be exercised here | Same UAT |

Suppression is self-invalidating: editing the UAT or re-running verification resurfaces both.
Nothing else in the milestone was deferred.

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
