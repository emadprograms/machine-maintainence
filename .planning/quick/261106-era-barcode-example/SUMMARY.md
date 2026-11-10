---
quick_id: 261106-era
slug: barcode-example
date: 2026-11-06
status: complete
commit: d263281
files_modified: [app/public/index.html, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-era — the barcode example

**Asked for:** "the barcode example should be 101220054."

Both machine dialogs now show `e.g. 101220054`.

## What else was wrong in the same two lines

The field had **two names**. The *New machine* dialog labelled it **Asset tag**; the table
header and the *Edit* dialog both say **Barcode**. Same column, same record, described two ways
in two dialogs a click apart — which is how a person concludes these are two fields.

Both say **Barcode** now, and both show the same example. `101220054` is the shape the labels
on the machines actually have; `MM-014` was invented back when the column was named
`asset_tag` in the database, which it still is — a column name is not a label.

## The check

One assertion reads both forms together rather than each in isolation:

* `<span>Barcode</span><input id="e-tag" placeholder="e.g. 101220054">` — exactly once,
* the same for `ee-tag`,
* and the words **Asset tag** appear nowhere on the page.

Checking each placeholder separately would pass if the two drifted to different examples,
which is the failure this task exists to fix.

## Mutation proofs

Three mutations, **three caught.**

| Mutation | Caught by |
|---|---|
| the creating form says "Asset tag" again | *both machine forms call the same field a barcode and show the same example* |
| the editor shows `MM-014` again | same |
| the example is off by one digit (`101220055`) | same |

Each was caught by the same assertion, which is the point: the check is about the *pair*, so
any change to either side, or to the name they agree on, fails it.
