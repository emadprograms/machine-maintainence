# Phase 13 — One visual language: context

## The complaint, in the user's words

Machines, work orders and maintenance "feel very off… completely outdated… empty."
Not a list of defects. A verdict on how the app presents itself.

## What that turned out to mean, concretely

The stylesheet was 35 lines. Every one of the seven screens was the same two
stacked cards, and in six of them **the create form came first** — a data-entry
form above a table, so the first thing a person saw was a form asking them to add
something to a list they could not yet see. Rows were bare `<td>` text with `—`
for every absent field. No page had a title. No table said how many rows it held.
Nothing responded to hover.

"Empty" is the accurate word: a page whose top third is a form and whose bottom
two-thirds is a four-column table with three rows does look empty.

## Requirements

- **SCREEN-01** — every screen opens with a header: its name, a one-line purpose, and the primary action on the right
- **SCREEN-02** — creating a record is behind a button, not occupying the page
- **SCREEN-02b** — no screen opens with a form
- **SCREEN-03** — lists read as records: hover, a heavier first column, muted secondary text, right-aligned numerics
- **SCREEN-04** — empty states are written sentences that say what to do next
- **SCREEN-05** — destructive actions name the record and the consequence

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Form placement | In a `<dialog>`, not a hidden div | Native focus trap, Esc to close, backdrop — and no JS to write for any of it |
| Dialog opening | Shared `openForm(id)`; every screen uses it | Seven bespoke toggles is how they drift apart |
| Empty states | Rendered by each loader, in the table's `tbody` as a full-width row | One row, no layout shift, and it disappears the moment there is data |
| Density | Row height and cell padding set once on `td`, not per table | The pages must look identical, not similar |
| Numerals | `font-variant-numeric: tabular-nums` on numeric cells | Columns of prices must line up |
| Destructive | Confirm names the record; the button says what it does | "Delete" alone makes the user guess |

## Why a dialog and not a drawer

A drawer needs positioning, a stacking context, focus management and a close
animation — four things to get wrong. `<dialog>` gives all four from the browser.
It also degrades honestly: without JS the dialog simply never opens, which is a
missing feature rather than a broken page.

## What must not change

Every id, every handler name, every API call. This phase is markup, CSS and the
loading functions' empty branches. If a screen stops working, the phase failed
regardless of how it looks.

## The honest limit

No browser is installed in this environment. Layout and colour are asserted in
CSS text and checked by reading the rules, not by looking at pixels. That gap is
stated in the verification report rather than papered over.
