# Requirements: Machine Maintenance — v2.0 Dashboard

**Milestone:** v2.0 Dashboard
**Status:** Defining — opened 2026-11-05
**Context:** v1.0 shipped the working core; v1.1 made every entity operable. Both
are archived in `.planning/milestones/`. This milestone changes how the
application presents itself rather than what it can do.

## Why this milestone exists

The app has seven screens behind a row of top tabs and no landing page. A
technician signing in lands on "Due soon", which answers one question and
nothing else: how many open jobs are there, how much stock is below its reorder
level, which machines are down. Those answers exist in the database and are
reachable only by visiting four separate pages and counting by eye.

The tabs also do not scale. Seven is already at the width where labels compete
for space, and the admin-only screens appearing and disappearing from the row
makes the navigation move depending on who signed in.

## v2.0 Requirements

### Navigation (NAV)

- [x] **NAV-01** — A persistent sidebar lists every screen the signed-in user may reach, with the current screen visibly marked
- [x] **NAV-02** — The sidebar collapses to an icon rail and expands back, and the chosen state survives a page reload
- [x] **NAV-03** — The sidebar shows only screens the user is permitted to open; a technician never sees Users or Backup
- [x] **NAV-04** — The existing screens remain reachable and unchanged in behaviour; this milestone moves the navigation, it does not alter what the screens do

### Dashboard (DASH)

- [x] **DASH-01** — Signing in lands on a dashboard showing, at minimum: open work orders, maintenance due within the warning window, parts at or below their reorder level, and machines marked down
- [x] **DASH-02** — Each summary shows the count **and** the few items that need action, so the user can act without navigating away
- [x] **DASH-03** — Each summary links to the screen that holds the full list
- [x] **DASH-04** — The dashboard is role-aware: a technician sees the operational summaries and no user or backup information
- [x] **DASH-05** — An empty state is honest — "no work orders open" reads differently from "could not load"

### Screens (SCREEN)

- [ ] **SCREEN-01** — Due soon, Machines, Work orders, Maintenance, Spare parts, Users and Backup share one visual language: consistent page headers, table styling, empty states and action placement
- [ ] **SCREEN-02** — Every screen opens with a page header — its name, a one-line purpose, and its primary action — and the list is the first thing visible, not a create form
- [ ] **SCREEN-03** — Every list has a designed empty state that names the screen's purpose and, where the user can act, offers the action inline
- [ ] **SCREEN-04** — Every destructive action states its consequence before it happens, in words specific to that action
- [ ] **SCREEN-05** — The app is usable at a laptop width and does not require horizontal scrolling to reach a primary action

## Constraints (unchanged, and binding)

- Plain JavaScript, no framework, no build step, no CDN, no external fonts or images
- Zero `node_modules`; the offline audit stays `OFFLINE-SAFE`
- Runs on Windows via `start.bat`
- **Readability is the bar**, not a line count: a beginner can read every file in
  one sitting, and any file over ~600 lines is a signal to split it. The shell and
  the dashboard are new browser modules, not more lines in `app.js`.

## Out of Scope (v2.0)

| Not doing | Why |
|---|---|
| Dark mode / theming | Presentation for its own sake; no operational value, and doubles the styling surface to verify |
| Charts and graphs | The data is small and discrete (counts and short lists). A chart of four numbers is decoration |
| Drag-and-drop dashboard customisation | Needs persisted per-user layout and a settings screen; not worth it at this scale |
| Mobile layout beyond "does not break" | The workshop runs on a desktop or laptop. A phone layout is a separate project |
| Rewriting the server API for the dashboard | The existing endpoints are tested; reuse is the default (see the phase plan for the decision) |

## Traceability

| REQ | Phase | Status | Evidence |
|---|---|---|---|
| NAV-01 | 11 | Complete | — |
| NAV-02 | 11 | Complete | — |
| NAV-03 | 11 | Complete | — |
| NAV-04 | 11 | Complete | — |
| DASH-01 | 12 | Complete | — |
| DASH-02 | 12 | Complete | — |
| DASH-03 | 12 | Complete | — |
| DASH-04 | 12 | Complete | — |
| DASH-05 | 12 | Complete | — |
| SCREEN-01 | 13 | Pending | — |
| SCREEN-02 | 13 | Pending | — |
| SCREEN-03 | 13 | Pending | — |
| SCREEN-04 | 13 | Pending | — |
| SCREEN-05 | 13 | Pending | — |
