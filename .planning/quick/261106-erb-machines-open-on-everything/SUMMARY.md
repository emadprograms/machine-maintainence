---
quick_id: 261106-erb
slug: machines-open-on-everything
date: 2026-11-06
status: complete
commit: ecb54e5
files_modified: [app/public/index.html, app/public/machines.js, app/public/app.css, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-erb — all machines by default

**Asked for:** "by default all machines should be visible in the filter. right now it only
shows 'in service'."

The Machines list now opens on **All machines**. *In service* is one click away.

## Why it was wrong, in one sentence

A machine retired last year looked exactly like a machine that had been deleted — the list
opened on a view that excluded it and the screen said nothing about what it was leaving out.
The machine somebody is looking for in a maintenance log is usually the one that stopped.

## What changed

| Where | Before | After |
|---|---|---|
| `#eq-filter` first option | *In service* | **All machines**, with `selected` so the intent is in the markup and not just in the ordering |
| `VIEWS[...] ?? …` fallback | `VIEWS.in` | `VIEWS.all` — an unreadable select must not silently narrow the list |
| A retired row | badge only | badge **and** `class="row-quiet"` (opacity .6, full on hover) |

The retired row is the one place the old constraint survives: dimmed, not hidden. Visible
enough to find, reopen or read its history; quiet enough not to compete with the machines that
are running. Nothing else moved — the dropdowns that start work, `/api/pm` and `/api/pm/due`
still ask for `?service=active`, so a retired machine still cannot be given a new job.

## Checks

Three added, one rewritten:

* **it opens on every machine, not only the ones in service** — the first option is
  `<option value="all" selected>All machines</option>`, read from the served page. The old
  assertion pinned *In service* as the default and is now the opposite assertion; its name
  says why.
* **a view the select cannot name falls back to everything** — reads the `?? VIEWS.all`.
* **a retired machine is dimmed in the list rather than missing from it** — the row template
  marks it, and the stylesheet actually styles what the template emits. Either half alone is a
  half-truth.

One existing check needed loosening rather than deleting: *the four views are in service, down,
retired and everything* matched `<option value="all">` exactly, which stops matching the moment
the default is marked. It now allows `<option value="all"[ >]` — the assertion is about the
four views existing, not about the tag being attribute-free.

## Mutation proofs

Five mutations, **five caught.**

| Mutation | Caught by |
|---|---|
| options re-sorted so *In service* is first again | *it opens on every machine…* |
| `selected` removed from *All machines* | *it opens on every machine…* |
| fallback back to `VIEWS.in` | *a view the select cannot name falls back to everything* |
| `row-quiet` removed from the row template | *a retired machine is dimmed…* |
| `.row-quiet td { opacity }` removed from the CSS | *a retired machine is dimmed…* |

## Not verified

Nobody has looked at the page since this change. The suite reads the markup and the template;
that a dimmed row at 60% opacity is the right amount of quiet is a judgement, and 60% is a
guess.
