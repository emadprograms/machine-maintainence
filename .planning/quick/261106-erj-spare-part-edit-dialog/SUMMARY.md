---
quick_id: 261106-erj
slug: spare-part-edit-dialog
date: 2026-11-07
status: complete
kind: quick
commit: ba5a10f
files_modified: [app/public/index.html, app/public/app.js, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# 261106-erj — the spare parts editor is a dialog too

**Asked for:** "i want the field to open for the spare parts edit as well" — the same treatment
the work order editor got in 261106-erf.

## What was there

Editing a part turned its **table row** into five inputs — name, reference, stock, price,
reorder level — with Save and Cancel in the last cell. Exactly the shape that was rejected for
work orders: the row stops being a row, the table jumps, and nothing else on the record is
reachable.

And one field was not reachable at all. `parts` has a `supplier` column; `POST /api/parts` has
always accepted it and the create form has always asked for it. The row editor had no such
input, so **a supplier could be set once, at creation, and never corrected.** That is the same
bug class as the work order editor missing notes and the photograph.

## What it is now

`#part-edit`, a dialog shaped like `#work-edit` and `#equipment-edit`:

* Title `Edit <name>`, and a line under it saying what the row said — `4 in stock from NSK`,
  plus *at or below the reorder level, so it is flagged on the list* when it is. The row shows
  a bare number and a colour; the dialog says it in words.
* Name, Reference, **Supplier**, In stock, Unit price, Reorder at — every column of the table
  plus the one that was missing.
* One **Save changes**. Every field is sent, so emptying the supplier or the price really
  empties it instead of leaving the old value behind (the route is partial-update by design and
  keeps whatever it is not told).
* Filled from `partsCache` before it opens — no second request, and no flash of the previous
  part's numbers.
* Empty name → `formError('part-edit', …)` before anything is sent.

The row is a row again: `strong` name, `soft` reference, the stock badge, the price, the
reorder level, then Edit and Delete. `editingPart` and `cancelPart()` are gone.

## Checks — 504 → 513

Nine, and the split is deliberate — six about the editor, three about where its save lands:

* the dialog carries the whole record (`pe-id`, `pe-name`, `pe-ref`, **`pe-supplier`**,
  `pe-qty`, `pe-price`, `pe-reorder`);
* the supplier is in it *and* in the request body — the field the row editor never offered;
* the parts table draws no inputs, and Edit still calls `editPart(id)`;
* the dialog is filled from `partsCache`, never from `api(...)`;
* filled **before** shown, by position in the function;
* one Save sends all six fields, and `reference`/`supplier` use `|| null` so emptying clears;
* an empty name is refused before the request;
* the route takes a corrected supplier and keeps the stock and the price;
* clearing the supplier clears it, rather than keeping the old one.

## Mutations — 9, all caught

| Mutation | Caught by |
|---|---|
| the supplier is not in the dialog | the id contract check and the record-completeness check |
| the dialog fetches the part again | *filled from the row that was clicked* |
| the save stops sending the supplier | the supplier check, and the body check |
| the save stops clearing what was emptied | `|| null` on reference |
| the row draws inputs again | *the parts table is a table again* |
| the dialog is opened before it is filled | *filled before it is shown* |
| an empty name reaches the server | *refuses an empty name* |
| a supplier once set can never be cleared | *clearing clears it* (route level) |
| editing the supplier zeroes the stock | the partial-update check, and the new stock check |

## Not verified

No browser has opened this dialog, and the parts screen has no sortable headings — the machine
table got those in 261106-eri and this table did not, because it was not asked for. Say the
word and it is the same six lines.
