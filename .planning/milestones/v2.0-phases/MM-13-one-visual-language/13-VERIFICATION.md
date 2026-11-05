---
phase: MM-13-one-visual-language
verified: 2026-11-05T17:10:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/MM-13-one-visual-language/13-01-PLAN.md
  - .planning/phases/MM-13-one-visual-language/13-01-SUMMARY.md
  - .planning/phases/MM-13-one-visual-language/13-02-PLAN.md
  - .planning/phases/MM-13-one-visual-language/13-02-SUMMARY.md
  - starter/public/index.html
  - starter/public/app.js
  - starter/scripts/smoke-test.js
covered_digest: "v4:sha256:f0aeb8c26a5e4dc837b5bd88113a9635846645807bb622dd07ca3f7f6b75995a"
behavior_unverified: 0
---

# Phase 13: One visual language Verification Report

**Phase Goal:** The screens stop looking outdated and empty.
**Verified:** 2026-11-05
**Status:** passed

## Goal Achievement

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every screen opens with its name, a purpose line and its action | ✓ VERIFIED | DOM: 8 headers (7 screens + dashboard), every one with an h2 and a 20+ character sentence |
| 2 | Creating is behind a button; no screen opens with a form | ✓ VERIFIED | DOM: every section's first child is `.page-head`; zero `.form-grid` outside a dialog; 5 dialogs, 5 header buttons, each targeting a dialog that exists |
| 3 | Lists read as records | ✓ VERIFIED | CSS: hover rule, `.cell-strong` weight, `.cell-muted` colour, `.cell-num` right + tabular, padding declared once on `th, td`. Source: `strong()` used on all four list loaders' first column |
| 4 | Empty states are sentences | ✓ VERIFIED | All six list loaders call `emptyRow()`; the helper escapes its sentence; a mutation that deletes one fails the suite |
| 5 | Destructive actions name the record and consequence | ✓ VERIFIED | `removeEquipment` and `removePart` interpolate the looked-up name and state "This cannot be undone" |

## Regression check

The 171 checks from phases 1–12 passed **before any Phase 13 assertion was
written**. That is the evidence that matters for a markup rewrite: every id and
handler survived, so the app still works.

## Test integrity

18 new assertions. Six mutations, six failures:

| Mutation | Caught by |
|---|---|
| Create form back on the machines page | "no form sits on a page outside a dialog" |
| `.cell-num` left-aligned | "numeric columns are right-aligned and tabular" |
| Delete prompt made vague | "deleting a machine names it and says what happens" |
| An empty state deleted | "every list has a written empty state" |
| A dialog's close button removed | "every dialog can be closed without JavaScript" |
| The Backup page header removed | header assertions, 3 of them |

## Two assertions were wrong before they were right

**The false positive.** "A failed load does not render as an empty list" first
matched the word *catch* inside `emptyRow`'s own comment and reported a bug that
did not exist.

**The false negative.** Rewritten to inspect catch *bodies*, it then missed the
real defect — a catch that swallows the error and lets execution fall through to
the empty render. Six mutations were needed to expose that the assertion was
asymmetric: it fired on innocent code and stayed silent on guilty code.

**The third version** asks whether a loader can turn a failed fetch into an empty
list, stripping comments first — which was itself necessary, because the second
version was fooled again by the word "catch" in a comment I wrote while fixing the
first.

This is now four consecutive phases where a green suite hid a live defect, and
the third where the assertion itself was the thing at fault.

## Not verified — and this one matters more here

**No browser is installed and installing Chromium is blocked.** Everything above
about appearance was verified by reading CSS rules and by rendering structure in
jsdom, which has no layout engine and no paint.

Specifically unverified:

- whether the page *looks* modern — the whole point of the phase
- spacing, colour and font rendering at any real size
- that the dialog's backdrop and shadow look right
- that the table does not overflow its card at 1280px
- hover actually felt, not merely declared

The structure and the rules are proven; the result is not seen. This is the phase
where that gap is largest, and it is stated plainly rather than implied by a
"passed" status.
