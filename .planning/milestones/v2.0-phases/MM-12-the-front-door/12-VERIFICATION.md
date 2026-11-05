---
phase: MM-12-the-front-door
verified: 2026-11-05T16:05:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/MM-12-the-front-door/12-01-PLAN.md
  - .planning/phases/MM-12-the-front-door/12-01-SUMMARY.md
  - .planning/phases/MM-12-the-front-door/12-02-PLAN.md
  - .planning/phases/MM-12-the-front-door/12-02-SUMMARY.md
  - starter/server.js
  - starter/public/dashboard.js
  - starter/public/index.html
  - starter/public/app.js
  - starter/scripts/smoke-test.js
covered_digest: "v4:sha256:a1f0a4a02d967c401ee08fd21be01993791ce65399433d3d8805638b2b9f7877"
behavior_unverified: 0
---

# Phase 12: The front door Verification Report

**Phase Goal:** Signing in answers "what needs my attention?" without visiting four
screens.
**Verified:** 2026-11-05
**Status:** passed

## Goal Achievement

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Signing in lands on a dashboard showing four counts | ✓ VERIFIED | DOM render: 4 cards, counts 3/1/7/0 from the payload; source assertion that login calls `showPage('dashboard')` |
| 2 | Each card shows the few items needing action, and says when there are more | ✓ VERIFIED | DOM: item rows render per shape; "and 6 more" appears when count 7 with 1 row; live server: count 7, items 5 |
| 3 | Each card leads to the screen that owns the full list | ✓ VERIFIED | DOM: clicking cards 1 and 3 navigated to work and parts. Suite asserts each section's exact href, and that every href names a real screen |
| 4 | The dashboard is role-aware | ✓ VERIFIED | No user or backup section exists in the endpoint at all; payload scan finds no email, password or user-shaped key; anonymous request 401 |
| 5 | Empty is distinguishable from broken | ✓ VERIFIED | DOM: empty card shows its sentence and no list element; error render shows no `.dash-count` at all and offers retry |

## Test integrity

Suite **151 → 171 checks**, 0 failures under `PATH=/nonexistent`.

Nine mutations were run. **Three survived first and the assertions were rewritten**:

| Mutation | Why it survived | Now |
|---|---|---|
| Count work orders without the `done` filter | every seeded order was open, so the bug was invisible | close one and assert the count drops by one → 2 failures |
| Delete two `escapeHtml` calls | the assertion counted calls against a loose threshold | every user-supplied field named → 2 failures |
| Point a card at a different real screen | "points at a real screen" was the entire assertion | exact href per section → 1 failure |

This is the third phase in a row where a green suite hid a live defect. The
pattern is consistent: assertions that check *presence* where they should check
*correspondence*.

## Not verified

- Visual layout at intermediate widths (the grid is `auto-fit minmax(260px)`).
- Whether five items per card is the right number — a judgement, not a fact.
