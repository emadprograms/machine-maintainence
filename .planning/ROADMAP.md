# Roadmap: Machine Maintenance — Lean Rebuild

## Milestones

- ✅ **v1.0 Lean core, offline, on Windows** — Phases 1–6 (shipped 2026-11-05)
- ✅ **v1.1 Operable** — Phases 7–10 (shipped 2026-11-05)
- ✅ **v2.0 Dashboard** — Phases 11–13 (shipped 2026-11-05)
- ✅ **v3.0 The record** — Phases 14–16 (shipped 2026-11-06)
- ✅ **v4.0 Stage correction and machine state** — autonomous milestone (shipped 2026-11-05)
- ✅ **v5.0 Work-order experience and print** — autonomous milestone (shipped 2026-11-05)

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

- [x] **Phase 11: The shell** — Sidebar navigation that collapses, role-aware, replacing the top tabs (NAV-01 … NAV-04) (completed 2026-11-05)
- [x] **Phase 12: The front door** — A dashboard with counts and action lists, role-aware, with honest empty states (DASH-01 … DASH-05) (completed 2026-11-05)
- [x] **Phase 13: One visual language** — Consistent headings, tables, empty states and destructive-action wording across all seven screens (SCREEN-01 … SCREEN-04) (completed 2026-11-05)

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
- [x] 11-01: Sidebar shell in a new module, replacing the tab row; collapse toggle with persisted state
- [x] 11-02: Role filtering, keyboard access, accessible names, and assertions proving no behaviour changed

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
- [x] 12-01: Dashboard module, data source decision, four role-aware cards
- [x] 12-02: Landing behaviour, empty states, links through to full lists, assertions

### Phase 13: One visual language
**Goal**: Seven screens that look like one modern application rather than seven
bare tables wrapped in cards.
**Depends on**: Phase 12
**Requirements**: SCREEN-01, SCREEN-02, SCREEN-03, SCREEN-04, SCREEN-05
**Success Criteria** (what must be TRUE):
  1. Every screen opens with a **page header**: its name, a one-line statement of
     what the screen is for, and its primary action on the right — not a create
     form occupying the top of the page
  2. Creating a record is behind a **"New …" button** that reveals the form, so the
     list is what you see first; the form opens, submits, and closes
  3. Every list carries a **summary line** above it ("12 machines · 2 down") so the
     screen answers its own question without counting rows
  4. Table rows have **row hover, a heavier first column, muted secondary text and
     right-aligned numerics**; no cell is bare unstyled text
  5. Empty states are designed, not a muted table row: they name the screen's
     purpose and offer the action inline
  6. One consistent **spacing and radius scale** across cards, forms and tables —
     the same thing looks the same on every screen
  7. Destructive actions state their consequence in the confirmation, in words
     specific to that action ("Delete Bearing 6204? It is not used on any job.")

**Notes**: This is the phase most likely to break working behaviour, because it
touches all seven screens at once. The smoke suite's wiring checks (every handler
exists, every looked-up id exists) exist for exactly this and must be extended to
the new shell and the collapsible forms.

**What "modern" means here, concretely** — the current app is 35 lines of CSS and
each screen is two stacked cards. The fixes are hierarchy, not decoration:
- a page header per screen replaces the lone `<h2>`
- the create form moves behind a button instead of sitting above the list
- rows gain hover, weight and alignment so the eye has somewhere to land
- numbers are tabular and right-aligned; dates are not ISO soup
- empty and error states are written as sentences

`node --check` misses template-literal errors inside `innerHTML`; the suite's
"every button calls a function that exists" check is the real guard.

**Plans**:
- [x] 13-01: Design primitives in CSS — spacing/radius scale, page header, toolbar, table treatment, designed empty state, button hierarchy
- [x] 13-02: Apply across all seven screens — page headers, create-behind-button, summary lines, row treatment, destructive wording, end-to-end pass

<details open>
<summary>✅ v3.0 The record (Phases 14–16) — SHIPPED 2026-11-06</summary>

**Goal:** answer the questions that follow a month of use — which machine keeps
breaking, when did we last touch it, and what is it costing. The app records all of it
already and can only say what needs attention now.

- [x] **Phase 14: The record** — a machine's own history, and a History screen of closed
      work with a date range (HIST-01 … HIST-04)
- [x] **Phase 15: Find it** — free-text search composed with the existing filters, and a
      CSV export built from the same filter (FIND-01 … FIND-04)
- [x] **Phase 16: What it cost** — labour hours, parts and labour cost per job, and a
      monthly report with its own export (COST-01 … COST-04)

**Requirements:** `.planning/milestones/v3.0-REQUIREMENTS.md`
**Phase records:** `.planning/milestones/v3.0-phases/`

</details>


## v7.0 Central reports and spare-part attachments — IMPLEMENTED (PR open)

- [x] Reports hub with work-order, monthly, machine service and inventory reports.
- [x] Spare-part photo/video and receipt attachments; expandable stage job reports.
- [x] Integration, regression, migration, offline and desktop/mobile verification.

Details: `.planning/milestones/v7.0-REPORTS-AND-PART-ATTACHMENTS.md`.
