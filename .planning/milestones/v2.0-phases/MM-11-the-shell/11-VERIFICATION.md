---
phase: MM-11-the-shell
verified: 2026-11-05T15:20:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/MM-11-the-shell/11-01-PLAN.md
  - .planning/phases/MM-11-the-shell/11-01-SUMMARY.md
  - .planning/phases/MM-11-the-shell/11-02-PLAN.md
  - .planning/phases/MM-11-the-shell/11-02-SUMMARY.md
  - starter/public/shell.js
  - starter/public/index.html
  - starter/public/app.js
  - starter/scripts/smoke-test.js
covered_digest: "v4:sha256:c79b7243547bcd7d30e1e430e881fad5710fff2991a9dfb85372606c6df56d2d"
behavior_unverified: 0
---

# Phase 11: The shell Verification Report

**Phase Goal:** Navigation that holds all seven screens without moving, and gives
content the rest of the width.
**Verified:** 2026-11-05
**Status:** passed

*Auditors are not installed in this environment (`agents_installed: false`), so the
audit ran inline: a jsdom render of the real module against the real markup, plus
the smoke suite.*

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every permitted screen is one click away and the current one is marked | ✓ VERIFIED | DOM: clicking entry 3 navigated to `work`; `.side-link.on` carries the active key and `aria-current="page"` |
| 2 | A toggle collapses to an icon rail and expands; the choice survives a reload | ✓ VERIFIED | DOM: collapsed class applied, `localStorage['mm.sidebar.collapsed']` = `1`, re-render restores collapsed, `aria-expanded` follows |
| 3 | A technician's sidebar contains no Users and no Backup entry | ✓ VERIFIED | DOM: five entries rendered, neither label present in the sidebar's markup |
| 4 | All seven screens behave exactly as before | ✓ VERIFIED | 151 smoke checks including every pre-existing behaviour assertion; two structural checks prove pages↔sections correspondence in both directions |
| 5 | The toggle is reachable by keyboard and the rail keeps accessible names | ✓ VERIFIED | Toggle is a `<button>` with `aria-controls`; entries are buttons with `aria-label`; `:focus-visible` now explicitly styled |

### Plan must-haves

| Plan | Must-have | Status |
|------|-----------|--------|
| 11-01 | A sidebar lists every permitted screen and marks the current one | ✓ |
| 11-01 | A toggle collapses to an icon rail and expands back | ✓ |
| 11-01 | The collapsed state survives a reload without a server round trip | ✓ |
| 11-01 | The toggle is a real button reachable by keyboard | ✓ |
| 11-02 | A technician's sidebar contains no Users and no Backup | ✓ |
| 11-02 | Toggle and entries reachable by keyboard with visible focus | ✓ |
| 11-02 | Every screen behaves exactly as it did | ✓ |

## Test integrity

Suite **138 → 151 checks**, 0 failures under `PATH=/nonexistent`.

Each new assertion was proved to fail:

| Mutation | Failing assertions |
|---|---|
| `aria-label` removed from entries | 1 |
| `localStorage` read left unguarded | 1 |
| `backup` removed from `PAGES` | 1 |
| `<nav id="tabs">` restored | 1 |

## The DOM harness, and the gap it leaves

The suite has no DOM, so it cannot prove a rendered sidebar works. During
verification the real `shell.js` was therefore loaded into jsdom against the real
`index.html` and driven through 14 checks, all passing. That harness needs a
dependency the project cannot carry (zero `node_modules` is a hard constraint), so
it is **not committed**.

What remains durable is structural: markup presence, the pages↔sections
correspondence, defensive storage, ARIA attributes. Those catch the realistic
regressions. They cannot catch a CSS change that makes the collapsed rail
unreadable — that stays a manual check, recorded here as unverified by automation.

## Not verified

- Visual appearance in a real browser: no browser is installed in this
  environment, and installing Chromium is blocked. Widths, transition timing and
  the collapsed rail's icon centring are asserted in CSS text but not seen.
- Narrow-window behaviour between 600px and 900px.
- The `Ctrl/Cmd+B` shortcut's interaction with browser-level shortcuts.
