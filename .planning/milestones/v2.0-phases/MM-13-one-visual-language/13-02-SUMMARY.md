---
phase: 13
plan: 2
name: Rows, empty states and destructive actions
status: complete
one-liner: Lists read as records, empty states are sentences, deletes name what they destroy
tasks: 3
files_modified: [starter/public/app.js, starter/public/index.html, starter/scripts/smoke-test.js]
requirements: [SCREEN-03, SCREEN-04, SCREEN-05]
commits: [eaca3a7]
---

# Plan 13-02: Rows, empty states and destructive actions

**Tasks:** 3
**Status:** Complete

## Rows

`.table` cells get 11px padding and a border set once for every table, so the
pages look identical rather than similar. `tbody tr:hover` tints the row.
`strong()` renders the first cell at weight 550; `soft()` renders secondary text
muted and replaces a bare `—` with "Not set"; `.cell-num` right-aligns with
`tabular-nums` so a price column lines up.

`money()` formats prices to two decimals. `stockCell()` now returns a whole
`<td>` rather than bare content, because it was the one cell that had escaped the
numeric alignment.

## Empty states

`emptyRow(colspan, sentence)` renders a single full-width cell. Used by all six
list loaders, and each sentence says what the state means: "No machines yet. Add
the first one and it will appear here." The parts list varies its sentence with
the filter — "Every part is above its reorder level. Nothing to order."

## Destructive actions

```
Delete "Lathe"?
Its work orders and maintenance history go with it. This cannot be undone.
```

`removeEquipment` now looks the record up so the confirmation can name it, for
the same reason `removePart` already did: a name containing a quote must not break
the button.

## The assertion that was wrong twice

The first version matched the word "catch" inside `emptyRow`'s own doc comment
and reported a bug that did not exist. The second inspected catch *bodies* and
therefore missed the real defect: a catch that swallows the error and lets
execution fall through to the empty render. The catch body is innocent in that
case — the damage is that the fetch line was replaced by a `try`.

The third version asks the right question: *can this loader turn a failed fetch
into an empty list?* It strips comments first, which was itself necessary — the
second attempt was fooled a second time by the word "catch" in a comment I added
while fixing the first.

It also surfaced a legitimate `catch` in `loadWork`: a technician may not read the
assignable-users list, so failing to fetch it is expected and must not be treated
as a failed work-order load. The assertion now excludes exactly that line; loading
the work orders themselves remains unguarded by any catch.

## Verification

Six mutations, six failures — create form back on the page, numeric alignment
removed, a vague delete, an empty state deleted, a dialog's close button removed,
a page header removed. Live server: all four assets serve, creating a machine /
work order / part through the same endpoints the dialogs call works, an empty name
still returns 400, and the dashboard reflects the new rows.

Suite: 189 checks, 0 failures.
