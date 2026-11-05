---
phase: 13
plan: 1
name: Page headers and forms behind buttons
status: complete
one-liner: Every screen opens with its name, purpose and action; every create form is behind a button
tasks: 3
files_modified: [starter/public/index.html, starter/public/app.js, starter/scripts/smoke-test.js]
requirements: [SCREEN-01, SCREEN-02, SCREEN-02b]
commits: [eaca3a7]
---

# Plan 13-01: Page headers and forms behind buttons

**Tasks:** 3
**Status:** Complete

## What was built

Seven `.page-head` blocks, one per screen (the dashboard got one too): an `<h2>`,
a `.page-sub` sentence, and the primary action on the right. Due soon puts its
window selector in the header's right side instead of a button.

Five `<dialog class="sheet">` blocks — machines, work orders, parts, maintenance,
users. Backup has no create action and no dialog, which is correct.

`openForm(id)` / `closeForm(id)` / `formDone(id)` / `formError(id, message)` in
`app.js`, shared by all five. Validation messages now appear next to the field
that caused them instead of in an `alert()` that blocks the page.

## Decisions

**`<dialog>`, not a drawer.** A drawer needs positioning, a stacking context,
focus management and a close animation — four things to get wrong. `<dialog>`
provides the focus trap, Esc, the backdrop and the modal state from the browser.

**No backticks in my own commit message.** (Recorded because it cost a minute: the
shell tried to interpolate `${...}` inside a double-quoted message.)

**Form fields gained labels.** The old forms were placeholder-only; a placeholder
disappears the moment you type in it. Each field now has a `<span>` label above
it. Same ids, same order, same values.

## Verification

23 rendered checks in jsdom, all passing, including that `openForm` actually opens
the real dialog and that every header button targets a dialog that exists.

The 171 pre-existing checks passed **before any new assertion was added** — the
part that mattered most, since the rewrite touched every id in the markup.

Suite: 171 → 189.
