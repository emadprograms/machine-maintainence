---
phase: MM-07-parts-become-maintainable
plan: 2
one-liner: "Each part carries its own reorder level, migrated onto existing databases with a default of 5 so no part silently changed meaning on upgrade."
wave: 1
subsystem: crud
tags: [node, sqlite, vanilla-js, offline]
provides:
  - parts.reorder_level column with ensureColumn migration
  - stockCell() badge rule, inclusive at the boundary
affects: [Spare parts]
actuals:
  tokens: 0
  tasks: 4
  commits: 0
tech-stack:
  added: []
  patterns: [ensureColumn-migrations]
key-files:
  created: []
  modified: [db.js, server.js, public/app.js, public/index.html, scripts/smoke-test.js]
key-decisions:
- "Default 5 preserves the old hardcoded threshold, so upgrading cannot change which parts look low"
- "The boundary is inclusive (qty <= level), so a part sitting exactly at its level is flagged"
duration: 1 session
completed: 2026-11-05
status: complete
---

# Phase 7 Plan 2: Per-part reorder level Summary

**The low-stock badge now reads data instead of a constant.**

## Accomplishments
- `parts.reorder_level`, added by `ensureColumn` so old database files migrate on next start
- `stockCell()` is the single badge rule: out → red, at-or-below level → amber, else the quantity
- Reorder level editable on both the create form and the inline edit row

## Decisions & Deviations
- Shipped inside plan 1's commit rather than its own; the two plans touch the same five files and
  splitting them would have produced a commit that could not pass its own tests.

## Verification
Assertions cover: default of 5 on create, per-part storage, two parts at equal quantity carrying
different levels, the inclusive boundary, and rejection of a negative level. All green.
