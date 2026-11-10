---
phase: 11
plan: 2
name: Role filtering, keyboard access, and proving nothing else moved
status: complete
one-liner: Role filtering reuses the existing flag, and five structural checks prove no screen moved
tasks: 3
files_modified: [starter/public/shell.js, starter/public/app.js, starter/scripts/smoke-test.js]
requirements: [NAV-03, NAV-04]
commits: [1785815]
---

# Plan 11-02: Role filtering, keyboard access, proving nothing moved

**Tasks:** 3
**Status:** Complete

## Role filtering

`renderShell` receives only the pages the user may reach — `app.js` filters on the
same `adminOnly` flag `buildTabs` used. Verified in the DOM: a technician's sidebar
has five entries and contains neither "Users" nor "Backup"; an admin's has seven.

This is presentation only. The server still returns 403 on both admin routes, and
those assertions are untouched — hiding a link is not access control, and the
phase notes say so explicitly so nobody later mistakes one for the other.

## Keyboard and focus

Entries are real `<button>` elements inside a `<nav>` landmark, so they are
tabbable in visual order and enter-activatable. The toggle reports
`aria-expanded` and `aria-controls`. A `:focus-visible` ring is now defined
explicitly — previously the stylesheet defined none, so the appearance depended
on the browser default. `Ctrl/Cmd+B` toggles the rail, matching the shortcut
editors use; the visible button remains the discoverable path.

## Proving no screen moved

Seven new structural assertions (13 in total for this phase):

- the tab row is gone, from both the markup and the script
- the sidebar exists in the markup
- the shell is in its own file — `renderShell` must not appear in `app.js`
- every page in `PAGES` has a matching `<section data-page>`, **and** every
  section has a matching page (both directions — one catches a removed screen,
  the other catches a removed nav entry)
- role filtering reads `PAGES.adminOnly` rather than a second list

## Proof the assertions bite

| Mutation | Failing assertion |
|---|---|
| `aria-label` removed from entries | "every entry carries an accessible name" |
| `localStorage` read unguarded | "the collapsed state is read defensively" |
| `backup` deleted from `PAGES` | "every section has a matching page" |
| `<nav id="tabs">` restored | "the tab row is gone" |

Suite: 138 → 151, 0 failures.
