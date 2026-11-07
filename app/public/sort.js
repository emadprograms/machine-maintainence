// Ordering for a table, kept apart from the table.
//
// It lives in its own file for one reason: the smoke suite imports this and runs the
// ordering for real, on rows, instead of looking for a comparator-shaped string in
// machines.js. Sorting is arithmetic between three awkward cases — numbers written
// as text, blanks, and ties — and a regex cannot tell you that "9" comes before "10".

// `numeric` so a barcode sorts as a number and not as a string of digits, which is
// the difference between 9, 10, 101220054 and 10, 101220054, 9. Case and accents are
// ignored: "pump" and "Pump" are the same word to somebody scanning a list.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Nothing to show: null, undefined, or only spaces. `soft()` draws an em dash for
 *  these, so they are a real state in this table rather than a missing value. */
export const isEmptyCell = (value) => value === null || value === undefined
  || String(value).trim() === '';

/** Two values of the same column, ascending. Blanks are not handled here: only the
 *  caller knows whether they belong at the top or the bottom. */
export function compareCells(a, b) {
  return collator.compare(String(a), String(b));
}

/**
 * The rows in the order asked for.
 *
 * - `direction` 1 is ascending, -1 descending.
 * - A blank cell goes last **whichever way** the sort runs. Sorting "Barcode"
 *   descending to find the biggest number should not hand you a screenful of
 *   machines with no barcode at all — that is the answer to a different question.
 * - Ties keep the order they arrived in, so two machines with the same category do
 *   not swap places every time the list is redrawn.
 * - The input is not touched. The caller keeps its own copy of the list, and a sort
 *   that quietly reorders it would make "the order the server sent" unrecoverable.
 */
export function sortRows(rows, valueOf, direction = 1) {
  const sign = direction < 0 ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const one = valueOf(a.row);
      const two = valueOf(b.row);
      const aBlank = isEmptyCell(one);
      const bBlank = isEmptyCell(two);
      if (aBlank !== bBlank) return aBlank ? 1 : -1;
      if (aBlank) return a.index - b.index;
      return sign * compareCells(one, two) || a.index - b.index;
    })
    .map((wrapped) => wrapped.row);
}
