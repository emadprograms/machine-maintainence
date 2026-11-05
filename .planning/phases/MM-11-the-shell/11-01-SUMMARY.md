---
phase: 11
plan: 1
name: Sidebar shell replacing the tab row
status: complete
one-liner: A collapsible sidebar rendered from the same PAGES array, in its own module
tasks: 3
files_modified: [starter/public/shell.js, starter/public/index.html, starter/public/app.js, starter/scripts/smoke-test.js]
requirements: [NAV-01, NAV-02]
commits: [1785815]
---

# Plan 11-01: Sidebar shell replacing the tab row

**Tasks:** 3
**Status:** Complete

## What was built

`starter/public/shell.js` — a module exporting `renderShell({ pages, current, onNavigate })`
and `markCurrent(key)`. It renders `<aside id="sidebar">` containing a brand mark,
a `<nav aria-label="Sections">` with one button per page, and a toggle at the
bottom. Each entry carries an inline SVG icon, an `aria-label`, and
`aria-current="page"` when it is the active screen.

`index.html` loses `<nav id="tabs">` and gains a `.layout` flex wrapper: a fixed
232px sidebar beside fluid content. `main` keeps its padding but the 1100px cap
became 1240px, because the sidebar now takes the horizontal slack the cap was
filling.

`app.js` keeps a classic `<script>` (the markup uses inline `onclick`, which needs
globals), so it loads the module with a dynamic `import('/shell.js')` and reaches
it through `window.shell`. `buildTabs()` now calls `renderShell`; `showPage` calls
`markCurrent` instead of toggling button classes.

## Decisions worth recording

**A separate file, not more app.js.** The readability constraint is the project's
core promise and `app.js` was already 424 lines. A new surface gets a new file.
The dynamic import is the price of keeping inline handlers working without a
build step.

**Same `PAGES` array.** The sidebar filters the array the screens are defined by,
using the same `adminOnly` flag. A second hand-maintained list is how navigation
drifts from reality; two structural assertions now guard the correspondence in
both directions.

**`localStorage`, wrapped.** Collapsed state is cosmetic and must not need the
server. Every access is inside `try/catch`, so a locked-down browser profile gets
an expanded sidebar rather than a failed page load.

## Verification

Rendered in jsdom against the real module and the real markup — **14/14**:
five entries for a technician, seven for an admin, no Users or Backup entry for a
technician, `aria-current` on the active screen, click navigation, collapse,
persistence across a re-render, and `aria-expanded` following the state.

That harness needs a dependency the project cannot carry, so it is not committed.
The durable assertions are structural; the gap is stated in the verification report.
