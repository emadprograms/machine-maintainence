---
phase: 12
plan: 2
name: The dashboard screen
status: complete
one-liner: Four cards on the landing page, each with a count, its items, and a way through
tasks: 3
files_modified: [starter/public/dashboard.js, starter/public/index.html, starter/public/app.js, starter/scripts/smoke-test.js]
requirements: [DASH-02, DASH-03, DASH-05]
commits: [8dfcc9a]
---

# Plan 12-02: The dashboard screen

**Tasks:** 3
**Status:** Complete

## What was built

`starter/public/dashboard.js` — a module exporting `renderDashboard(container,
data)` and `renderDashboardError(container, message)`. Its own file, for the same
readability reason as the shell.

Four cards in a responsive grid. Each shows a label, a large count, up to five
item rows, and a button to the screen that owns the rest. When the count exceeds
the rows shown, the card says "and N more" — silence there would make a capped
list look complete.

`PAGES` gains `dashboard` first and `index.html` gains its section; the existing
pages↔sections assertions cover the pairing in both directions automatically.
Sign-in now calls `showPage('dashboard')`.

## The two states that must not look alike

A card with nothing to report and a dashboard that failed to load would both
render as zeroes, and zeroes read as all clear. So a failed load is a distinct
render: it names the failure, offers a retry, and contains no counts at all.

## Verification

Rendered in jsdom, **14/14**: four cards, counts taken from the server rather than
counted from items (3/1/7/0 with 2/1/1/0 rows), the "and 6 more" line, the empty
card's sentence with no empty list element, overdue wording, click-through
navigation, a hostile `<img onerror>` title rendered as inert text, and the error
state rendering without any `.dash-count`.

The hostile-title check is the one that matters most: part names and work-order
titles are free text, and the renderer builds markup by string concatenation.

Suite: 151 → 171, 0 failures.
