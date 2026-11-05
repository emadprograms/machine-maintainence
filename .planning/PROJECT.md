# Machine Maintenance — Lean Rebuild

## What This Is

A small, offline, Windows-based web app for tracking industrial machines, work orders, recurring preventive maintenance and spare parts. It is a rebuild of the useful parts of `Ilop08/SIAI` (reviewed in `CODE_REVIEW.md`) using a deliberately small stack: Node's built-in HTTP server and built-in SQLite, plain JavaScript, and one HTML page. It targets a restricted network with only Windows machines and no internet access.

## Core Value

**A beginner can read the entire codebase in one sitting and add a field, a page or a maintenance schedule in minutes — while the database survives crashes, reboots and power cuts intact.**

## Current Milestone: v1.1 Operable

**Goal:** Complete the operational coverage of a shipped, working application — every entity
editable, stock that can go up as well as down, and work that belongs to somebody.

**Starting point:** v1.0 is a working application in daily-use terms: it runs offline on Windows,
persists through power loss, enforces authentication and roles, and tracks machines, work orders,
parts and recurring maintenance. What it lacks is *completeness of operations* — several records
can be created but not corrected, and one input is silently discarded.

**Target features:**
- Restock, edit and delete a part (today `qty` only ever decreases and a typo is permanent)
- Assign a work order to a technician, and edit a work order after creation
- Fix `mark done` silently ignoring a supplied date (`req.body` is never assigned)
- Per-part reorder level replacing the hardcoded `qty < 5`
- CSV export for work orders and parts
- Login throttling

**Accepted debt:** no audit log, no concurrency control — both deferred with reasons in
REQUIREMENTS.md.

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

### Active

Tracked in `.planning/REQUIREMENTS.md` for v1.1 (IDs `PART-*`, `WO-*`, `PM-*`, `CSV-*`,
`AUTH-*`). v1.0's eleven requirements above are all validated and archived.

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
- **Codebase now:** `starter/` — `db.js` (142), `auth.js` (48), `server.js` (366),
  `public/index.html` (216), `public/app.js` (269), plus `scripts/smoke-test.js` (265,
  **47 checks**) and `scripts/audit-offline.js` (151). 7 tables (users, equipment,
  work_orders, parts, work_order_parts, pm_schedule + schema versioning via `ensureColumn`).
- **Test suite:** 47 passing checks including a `SIGKILL` durability test and a stock-rollback
  test; offline audit reports `OFFLINE-SAFE`. Verified under `PATH=/nonexistent` so no Unix
  shell tool is assumed.
- **Known technical debt:** sessions live in process memory, so a restart signs everyone out;
  concurrent edits are last-write-wins (single process, never tested with two browsers);
  `node:sqlite` is still experimental on Node 22, so every entry point passes
  `--no-warnings=ExperimentalWarning`.
- **Bugs found and fixed:** 11, logged in `.planning/STATE.md`. Three were only reachable
  through testing rather than reading — an unauthenticated-`GET` guard that never ran, the
  admin self-disable lockout, and a technician-readable staff list found by clicking through
  the running application after the milestone was already closed.
- **Not verified anywhere:** `EBUSY` cleanup timing on Windows (written for `cmd.exe`
  semantics, exercised only via `PATH=/nonexistent` on Linux).

- Source of the review that motivates this rebuild: `CODE_REVIEW.md` (verified findings, tags `[read]` / `[ran]`).
- User profile: knows Python and basic web concepts; not experienced with React or TypeScript; will modify the app with AI assistance.
- Environment: restricted network, Windows only, no internet. Anything needed must be installed on a connected machine and copied over.
- Prior art to reuse deliberately:
  - password hashing + token approach from `Ilop08/SIAI` `backend/src/lib/auth.ts`
  - `ensureColumn()` migration helper from `backend/src/database.ts:364`
  - colour palette from `frontend/tailwind.config.js`
  - data-model shape for equipment / faults / spare parts (tables redrawn, not copied)
- Scaffold already written (this branch, `starter/`): `db.js`, `auth.js`, `server.js`, `public/index.html`. It is a starting point to be completed and verified phase by phase, not a finished product.

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
