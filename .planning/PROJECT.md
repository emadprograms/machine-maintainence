# Machine Maintenance — Lean Rebuild

## What This Is

A small, offline, Windows-based web app for tracking industrial machines, work orders, recurring preventive maintenance and spare parts. It is a rebuild of the useful parts of `Ilop08/SIAI` (reviewed in `CODE_REVIEW.md`) using a deliberately small stack: Node's built-in HTTP server and built-in SQLite, plain JavaScript, and one HTML page. It targets a restricted network with only Windows machines and no internet access.

## Core Value

**A beginner can read the entire codebase in one sitting and add a field, a page or a maintenance schedule in minutes — while the database survives crashes, reboots and power cuts intact.**

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **REQ-01** — Data persists to a single SQLite file that survives restart, `kill -9` and power loss, with no whole-file rewrite per request
- [ ] **REQ-02** — Login works offline; passwords hashed (scrypt); the signing secret is generated per install, never hardcoded; logout revokes the session
- [ ] **REQ-03** — Only an admin can create users; no public self-registration
- [ ] **REQ-04** — Machines can be added, edited, retired and listed
- [ ] **REQ-05** — Work orders/faults can be created against a machine and moved open → in progress → done
- [ ] **REQ-06** — Spare parts have stock levels; using a part on a job decrements stock in one transaction
- [ ] **REQ-07** — Recurring preventive maintenance: task + interval in days + next due date; "due soon" view; mark-done rolls the date forward
- [ ] **REQ-08** — Runs on Windows with no internet: no CDN, no fonts, no external APIs, no npm packages at runtime
- [ ] **REQ-09** — Portable: copy the folder, run a `.bat`, open a browser
- [ ] **REQ-10** — One-command backup of the database to a dated file
- [ ] **REQ-11** — Adding a new field or table is documented and takes one edit in one file

### Out of Scope

- Camera / QR scanning — needs HTTPS on a LAN, adds `getUserMedia` complexity; not core to the four needs
- "AI" diagnosis and chatbot — the reviewed repo's versions were regex over equipment names; no signal, no offline model
- Kanban drag-and-drop board — a status dropdown covers the same workflow with a fraction of the code
- Multi-company tenancy (companies, clients, portals) — one workshop, one organisation
- React / TypeScript / Vite / build step — the user is a beginner in plain JavaScript and wants to read every line
- PWA / service worker / offline cache — the app is served from the local machine and is therefore already offline
- Email / push notifications — requires an internet mail relay or HTTPS; replaced by an in-app "due soon" page plus an optional scheduled backup/digest task

## Context

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
- **Code size:** target ≤ ~1,200 lines total including HTML/CSS/JS.
- **Portability:** No native modules, no compiled artifacts, no platform-specific binaries in the repo.
- **Language:** English UI (the reviewed repo was French; the user works in English).
- **Security bar:** GSD security ASVS level 1, block on `high`.

## Key Decisions

| Decision | Rationale | Status |
|---|---|---|
| Node built-in `node:sqlite` instead of `sql.js` | Real transactions, WAL, FK/CHECK enforcement, no whole-file export per write; removes the reviewed repo's biggest flaw | Accepted (verified working on Node 22.22) |
| Built-in `node:http` instead of Express | One less dependency; the routing table in `server.js` is ~20 lines | Accepted |
| Plain JavaScript, no TypeScript | User is a beginner; no build step; fewer moving parts when copying to an offline machine | Accepted |
| One `index.html` instead of React | Readable end-to-end, no bundler, no framework version drift | Accepted |
| Cookie session instead of `localStorage` token | `HttpOnly` cookie cannot be read by injected script; logout can revoke server-side | Accepted |
| `node:sqlite` is experimental in Node 22 | Suppress with `--no-warnings=ExperimentalWarning`; documented as the one upgrade risk | Accepted, documented |
