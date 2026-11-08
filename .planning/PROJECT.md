# Machine Maintenance — Lean Rebuild

## What This Is

A small, offline, Windows-based web app for tracking industrial machines, work orders, recurring preventive maintenance and spare parts. It is a rebuild of the useful parts of `Ilop08/SIAI` (reviewed in `CODE_REVIEW.md`) using a deliberately small stack: Node's built-in HTTP server and built-in SQLite, plain JavaScript, and one HTML page. It targets a restricted network with only Windows machines and no internet access.

## Core Value

**A beginner can read the entire codebase in one sitting and add a field, a page or a maintenance schedule in minutes — while the database survives crashes, reboots and power cuts intact.**

## Current Milestone: none — v3.0 The record shipped

**Shipped 2026-11-06.** v3.0 answered the questions that arrive after a month of use:
which machine keeps breaking, when did we last touch it, and what did it cost.

- A machine's own history, and a History screen of closed work narrowable to a date range
- One search box per list, composing with every filter, with exports built from the same
  filter so the file cannot disagree with the screen
- Labour hours, parts and labour cost per job, and a monthly report with its own export

The next milestone is not yet chosen. The strongest candidate is an audit trail (who
changed what), which has been out of scope since v1.0 and is now the largest gap.

## Requirements

### Validated

- ✓ **REQ-01** — Data persists to a single SQLite file that survives restart, `kill -9` and power loss, with no whole-file rewrite per request — v1.0
- ✓ **REQ-02** — Login works offline; passwords hashed (scrypt); the signing secret is generated per install, never hardcoded; logout revokes the session — v1.0
- ✓ **REQ-03** — Only an admin can create users; no public self-registration — v1.0
- ✓ **REQ-04** — Machines can be added, edited, retired and listed — v1.0
- ✓ **REQ-05** — Work orders/faults can be created against a machine and moved open → in progress → done — v1.0
- ✓ **REQ-06** — Spare parts have stock levels; using a part on a job decrements stock in one transaction — v1.0
- ✓ **REQ-07** — Recurring preventive maintenance: task + interval in days + next due date; "due soon" view; mark-done rolls the date forward — v1.0
- ✓ **REQ-08** — Runs on Windows with no internet: no CDN, no fonts, no external APIs, no npm packages at runtime — v1.0 (offline audit + real browser)
- ✓ **REQ-09** — Portable: copy the folder, run a `.bat`, open a browser — v1.0 (Windows 11, Node 26.3.0)
- ✓ **REQ-10** — One-command backup of the database to a dated file — v1.0
- ✓ **REQ-11** — Adding a new field or table is documented and takes one edit in one file — v1.0

- ✓ **HIST-01…04** — a machine's history, a closed-work log, a date range, and three
  distinct empty states — v3.0
- ✓ **FIND-01…04** — search over work orders and machines that composes with every
  filter, with exports built from the same filter — v3.0
- ✓ **COST-01…04** — labour hours, cost per job at one configured rate, a monthly report
  and its CSV — v3.0

### Active

Nothing. v1.0's eleven requirements, v1.1's (`PART-*`, `WO-*`, `PM-*`, `CSV-*`, `AUTH-*`),
v2.0's (`SHELL-*`, `DASH-*`, `SCREEN-*`) and v3.0's (`HIST-*`, `FIND-*`, `COST-*`) are all
validated. `.planning/REQUIREMENTS.md` tracks the next milestone once it is chosen.

### Out of Scope

- Camera / QR scanning — needs HTTPS on a LAN, adds `getUserMedia` complexity; not core to the four needs
- "AI" diagnosis and chatbot — the reviewed repo's versions were regex over equipment names; no signal, no offline model
- Kanban drag-and-drop board — a status dropdown covers the same workflow with a fraction of the code
- Multi-company tenancy (companies, clients, portals) — one workshop, one organisation
- React / TypeScript / Vite / build step — the user is a beginner in plain JavaScript and wants to read every line
- PWA / service worker / offline cache — the app is served from the local machine and is therefore already offline
- Email / push notifications — requires an internet mail relay or HTTPS; replaced by an in-app "due soon" page plus an optional scheduled backup/digest task

## Context

- **Shipped v1.0 (2026-11-05):** 6 phases, 6 plans, 22 tasks, ~1,040 lines of application
  code plus ~370 lines of test code. All eleven requirements validated; archived under
  `.planning/milestones/v1.0-*`.
- **Codebase now (2026-11-06):** `app/` — about 3,970 lines of application code and
  1,920 of tests. `server.js` is 116 lines of startup and routing; the handlers live in
  `routes/`, one file per screen group (auth 52, record 43, equipment 118, work-orders 95,
  parts 135, pm 77, dashboard 76, admin 81, report 56). Shared plumbing: `http.js` (135),
  `values.js` (54), `who.js` (26), `db.js` (316), `filters.js` (138), `report.js` (97),
  `status.js` (86) and `photos.js` (71) — the two new modules for 261106-eqs. Client:
  `index.html` (443), `app.css` (234), `app.js` (560), `shell.js` (121), `dashboard.js`
  (136), `history.js` (147), `report.js` (79), `machines.js` (273). Eight tables (users,
  equipment, work_orders, parts, work_order_parts, pm_schedule, sessions, settings, plus
  `ensureColumn` migrations), and machine photographs as files in `photos/`.
- **Test suite:** **523 checks**, 0 failures, under `PATH=/nonexistent`. It covers a
  `kill -9` restart, sessions surviving a restart, a lone copy of `maintain.db` opening
  with its data, search composing with every filter, exports matching their screens, and a
  month's costs adding up, and the machine-state matrix: high-priority open ⇒ down, job
  closed ⇒ running, retired outranking both. Since 261106-eqz it also proves that signing
  out revokes the session server-side (a captured cookie stops working), that the history
  export honours its filter, and that every endpoint in `routes/` is named somewhere in the
  suite — a coverage floor read from the source, not a hand-written list. Offline audit
  reports `OFFLINE-SAFE`.
- **Known technical debt:** concurrent edits are last-write-wins (single process, never
  tested with two browsers).
  `node:sqlite` is still experimental on Node 22, so every entry point passes
  `--no-warnings=ExperimentalWarning`. The v2.1 persistence fix has never run on Windows;
  the check for it is `LOCAL-AGENT-VERIFY-PROMPT.md`.
- **Bugs found and fixed:** 11, logged in `.planning/STATE.md`. Three were only reachable
  through testing rather than reading — an unauthenticated-`GET` guard that never ran, the
  admin self-disable lockout, and a technician-readable staff list found by clicking through
  the running application after the milestone was already closed.
- **Not verified anywhere:** the whole app on Windows since the v2.1 persistence fix
  (data folder moved to `%LOCALAPPDATA%`, sessions in the database, checkpoint on every
  write); `EBUSY` cleanup timing on Windows; and any screen in a real browser, since none
  exists in the build environment.

- Source of the review that motivates this rebuild: `.planning/milestones/v1.0-CODE-REVIEW.md`
  (verified findings, tags `[read]` / `[ran]`). The reviewed application itself was removed
  from this repository on 2026-11-06; its paths survive in the archive and in git history.
- User profile: knows Python and basic web concepts; not experienced with React or TypeScript; will modify the app with AI assistance.
- Environment: restricted network, Windows only, no internet. Anything needed must be installed on a connected machine and copied over.
- Prior art to reuse deliberately:
  - password hashing + token approach from `Ilop08/SIAI` `backend/src/lib/auth.ts`
  - `ensureColumn()` migration helper from `backend/src/database.ts:364`
  - colour palette from `frontend/tailwind.config.js`

  (Those three paths are in `Ilop08/SIAI`, not in this repository, which now holds only
  `app/`.)
  - data-model shape for equipment / faults / spare parts (tables redrawn, not copied)
- Scaffold already written (this branch, `app/`): `db.js`, `auth.js`, `server.js`, `public/index.html`. It is a starting point to be completed and verified phase by phase, not a finished product.

## Constraints

- **Runtime:** Node.js 22+ (for `node:sqlite`), no other runtime dependency. No `npm install` at runtime.
- **Database:** SQLite in WAL mode, single file under `data/`, path overridable with `MM_DB`.
- **Code size:** no hard line target (the v1.0 figure of ≤ ~1,200 was dropped at the
  v1.1 boundary, since v1.0 shipped at 1,041 and v1.1 adds CRUD to every entity). The bar
  is qualitative and binding: **a beginner can still read every file in one sitting**, and
  any single file over ~600 lines is a signal to split it.
- **Portability:** No native modules, no compiled artifacts, no platform-specific binaries in the repo.
- **Language:** English UI (the reviewed repo was French; the user works in English).
- **Security bar:** GSD security ASVS level 1, block on `high`.

## Key Decisions

| Decision | Rationale | Status |
|---|---|---|
| Node built-in `node:sqlite` instead of `sql.js` | Real transactions, WAL, FK/CHECK enforcement, no whole-file export per write; removes the reviewed repo's biggest flaw | ✓ Good — verified on Node 22.22 and 26.3.0 |
| Built-in `node:http` instead of Express | One less dependency; the routing table in `server.js` is ~20 lines | ✓ Good — 300+ lines of routes, still readable |
| Plain JavaScript, no TypeScript | User is a beginner; no build step; fewer moving parts when copying to an offline machine | ✓ Good — whole app copied to Windows as plain files |
| One `index.html` instead of React | Readable end-to-end, no bundler, no framework version drift | ✓ Good |
| Cookie session instead of `localStorage` token | `HttpOnly` cookie cannot be read by injected script; logout can revoke server-side | ✓ Good, with one limit: in-memory store means a restart signs everyone out |
| `node:sqlite` is experimental in Node 22 | Suppress with `--no-warnings=ExperimentalWarning`; documented as the one upgrade risk | ⚠️ Revisit on each Node upgrade |
| Sessions in process memory instead of a sessions table | Simplest correct option; SQLite holds durable business data, not transient auth | ✓ Good — documented limitation, no data loss |
| `ensureColumn()` as the entire migration mechanism | Proven pattern from the reviewed repo; one line per added field, no migration framework | ✓ Good — survived 11 bug-fix rounds |
| Pure-JavaScript offline scan instead of shelling out | `grep` does not exist in `cmd.exe`; shelling out made the suite fail on the one platform it exists to prove | ✓ Good — caught by the Windows UAT |
| Smoke test runs under `PATH=/nonexistent` in CI-style checks | Simulates the Windows shell more faithfully than trusting that a command exists | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-05 — v1.1 milestone opened*
