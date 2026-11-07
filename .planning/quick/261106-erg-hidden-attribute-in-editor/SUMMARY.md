---
quick_id: 261106-erg
slug: hidden-attribute-in-editor
date: 2026-11-07
status: complete
commit: dd2f96d
files_modified: [app/public/app.css, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-erg — two Owner fields in the work-order editor

**Asked:** "why are there two owner options in work orders edit?"

## Because `hidden` does not hide

The editor has two owner controls and shows one:

| | For an admin | For a technician |
|---|---|---|
| `#we-owner` — a select of people | shown | hidden |
| `#we-owner-locked` — a read-only name and a line explaining why | hidden | shown |

Switching used the `hidden` attribute. But `hidden` is only a **browser** rule, and any
author rule that sets `display` beats it — `.field { display: flex }` did. So the attribute
had no visible effect at all: **both** fields rendered, every time, for everybody. An admin
saw the select plus a read-only "Nobody yet" underneath it; a technician saw an empty select
above the real answer, which is worse — an empty dropdown invites a save that would clear the
owner.

The stylesheet already had `.hidden { display: none !important }` for the page sections, and
that class works — the attribute did not.

## The fix

```css
[hidden] { display: none !important; }
```

`!important` is load-bearing: `.field` and `[hidden]` are equally specific, so without it the
answer depends on which rule comes later in the file.

## Checks

Two, both of which fail on the state this task started from:

* **the hidden attribute hides, whatever display the element has** — reads the stylesheet for
  a `[hidden]` rule with `display: none` **and** `!important`, and requires that `.field` still
  sets `display: flex` (if it ever stops, the rule is merely belt and braces and the check
  should be reconsidered, not silently kept).
* **and the editor shows one owner control at a time** — the read-only label exists, and
  `editWork` switches exactly one of the two on.

## Mutation proofs

Three mutations, **three caught.**

| Mutation | Caught by |
|---|---|
| the `[hidden]` rule is deleted — the two Owner fields come back | *the hidden attribute hides…* |
| the rule loses `!important` | *the hidden attribute hides…* |
| the read-only owner is never switched off | *one owner control at a time* |

## What this says about the rest of the page

Any other element relying on the `hidden` attribute had the same non-behaviour; the section
switching uses the `.hidden` class and was never affected. Nothing else in the markup uses the
attribute today — but the rule is one line, and the next person to use it will get what they
asked for.
