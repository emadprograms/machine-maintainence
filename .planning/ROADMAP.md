# Roadmap: Machine Maintenance — Lean Rebuild

## Milestones

- ✅ **v1.0 Lean core, offline, on Windows** — Phases 1–6 (shipped 2026-11-05)
- ✅ **v1.1 Operable** — Phases 7–10 (shipped 2026-11-05)
- 🚧 **v2.0 Dashboard** — Phases 11–13 (in progress)

## Phases

<details>
<summary>✅ v1.0 Lean core, offline, on Windows (Phases 1–6) — SHIPPED 2026-11-05</summary>

Six phases building the working application: persistence proven through `kill -9`,
authentication with roles, machines and work orders, spare parts with transactional
consumption, recurring maintenance, and the Windows/offline proof.

</details>

<details>
<summary>✅ v1.1 Operable (Phases 7–10) — SHIPPED 2026-11-05</summary>

**Goal:** Complete the operational coverage of the working application — every entity
editable, stock that can go up as well as down, and work that belongs to somebody.

- [x] **Phase 7: Parts become maintainable** — Restock, edit, delete, and a per-part reorder level (PART-01 … PART-05)
- [x] **Phase 8: Work belongs to somebody** — Assign and edit work orders without weakening the role boundary (WO-01 … WO-04)
- [x] **Phase 9: Honest dates and real exports** — Fix the silently-dropped completion date; export work orders and parts to CSV (PM-01 … PM-03, CSV-01 … CSV-04)
- [x] **Phase 10: Login hardening** — Throttle repeated failed logins (AUTH-01 … AUTH-03). **Amended after close:** the throttle was removed in favour of recording failed sign-ins; see `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

</details>

## v2.0 — Dashboard

**Goal:** Change how the application presents what it already knows. A technician
signing in should see the state of the workshop at a glance, and navigate from a
sidebar that does not move or run out of room.

**Starting point:** v1.1 is a complete, working application: every entity CRUD,
dates honoured, CSV exports, roles enforced. What it lacks is a front door. There
are seven screens behind a row of tabs, no landing page, and the four numbers that
describe the workshop are only obtainable by visiting four pages and counting.

**What makes this a major version:** v1.0 and v1.1 asked *what can the app do*.
This asks *how does it present itself* — a new shell, a new landing page, and a
rewritten presentation layer across six screens.

### Phases

- [ ] **Phase 11: The shell** — Sidebar navigation that collapses, role-aware, replacing the top tabs (NAV-01 … NAV-04)
- [ ] **Phase 12: The front door** — A dashboard with counts and action lists, role-aware, with honest empty states (DASH-01 … DASH-05)
- [ ] **Phase 13: One visual language** — Consistent headings, tables, empty states and destructive-action wording across all seven screens (SCREEN-01 … SCREEN-04)

## Phase Details

### Phase 11: The shell
**Goal**: Navigation that holds all seven screens without moving, and gives content the rest of the width.
**Depends on**: v1.1 (complete)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. Every permitted screen is one click away from every other, and the current one is visibly marked
  2. A toggle collapses the sidebar to icons and expands it; the choice survives a reload
  3. A technician's sidebar contains no Users and no Backup entry — verified by signing in as one, not by reading the filter
  4. All seven screens render and behave exactly as they did before; the smoke suite's behaviour assertions are untouched
  5. The toggle is reachable by keyboard, and the icon rail keeps an accessible name for each entry

**Notes**: `PAGES` in `public/app.js` already defines the seven screens and the
admin-only flag, so the sidebar is a rendering change, not a data change. The
risk is that `app.js` is 424 lines already; the shell belongs in its own file.
Persisting the collapsed state must not require the server — `localStorage` is
appropriate here precisely because the state is cosmetic.

**Plans**:
- [ ] 11-01: Sidebar shell in a new module, replacing the tab row; collapse toggle with persisted state
- [ ] 11-02: Role filtering, keyboard access, accessible names, and assertions proving no behaviour changed

### Phase 12: The front door
**Goal**: Signing in answers "what needs attention?" without asking the user to visit four pages.
**Depends on**: Phase 11
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. The dashboard shows open work orders, maintenance due soon, parts at or below reorder level, and machines down — each with a count
  2. Each card lists the items that need action, and clicking through reaches the full list on the owning screen
  3. A technician sees the operational cards and no user or backup information — verified by signing in as one
  4. A card with nothing to report says so in words that cannot be confused with a failure to load
  5. The dashboard is the landing page for every signed-in user

**Notes**: Decide in the plan whether to add one `/api/dashboard` endpoint or
reuse the four existing list endpoints, and record the reason. Reuse adds no
server code and leans on queries that are already asserted; a single endpoint is
one round trip but is a new thing to trust. Either is defensible — silence is not.

The "due soon" window on this page should match the Due soon screen's selector
rather than inventing a second definition of "soon".

**Plans**:
- [ ] 12-01: Dashboard module, data source decision, four role-aware cards
- [ ] 12-02: Landing behaviour, empty states, links through to full lists, assertions

### Phase 13: One visual language
**Goal**: Seven screens that look like one application rather than seven.
**Depends on**: Phase 12
**Requirements**: SCREEN-01, SCREEN-02, SCREEN-03, SCREEN-04
**Success Criteria** (what must be TRUE):
  1. Headings, tables, buttons and spacing are consistent across all seven screens — the same thing looks the same everywhere
  2. Every list has an empty state that names the screen's purpose, and offers the action where one exists
  3. Every destructive action states its consequence before it happens, in words specific to that action
  4. No primary action requires horizontal scrolling at laptop width

**Notes**: This is the phase most likely to break working behaviour, because it
touches all seven screens at once. The smoke suite's wiring checks (every handler
exists, every looked-up id exists) exist for exactly this and should be extended
to the new shell.

`node --check` misses template-literal errors inside `innerHTML`; the suite's
"every button calls a function that exists" check is the real guard.

**Plans**:
- [ ] 13-01: Shared presentation — a small set of reusable render helpers and the page heading pattern
- [ ] 13-02: Apply across all seven screens, empty states, destructive-action wording, end-to-end pass
