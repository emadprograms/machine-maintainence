// The two things every table in this app now does the same way.
//
// Sorting used to live in machines.js, written for that one table. Once the parts,
// work orders, history, maintenance, users, due and report tables all wanted it, a
// copy per screen would have drifted within a week — one arrow, one `aria-sort`, one
// place that decides whether the third click goes back to ascending. Same for the
// three-dot menu: its markup, its positioning and its "close when the page moves"
// rule are identical whether the row is a machine or a spare part.
//
// A table registers once: what each sortable column holds, and how to redraw itself.
// Everything else — the click, the direction, the arrow, the state that survives a
// reload — is here.

import { sortRows } from './sort.js';

// tbody id -> { columns, redraw }
const registered = new Map();
// tbody id -> { key, dir } — kept between redraws, which is what stops the arrows
// from being decoration the moment a search or a save reloads the list.
const sorted = new Map();

/**
 * @param tbodyId  the id of the `<tbody>` — it names the table for everything here
 * @param columns  sort key -> a function of a row; a key that is missing cannot be
 *                 clicked, so the markup cannot offer a sort nothing can perform
 * @param redraw   draws that table again from whatever it already holds. Must not
 *                 fetch: clicking a heading is not a reason to ask the server.
 */
export function register(tbodyId, columns, redraw) {
  if (!document.getElementById(tbodyId)) return;
  registered.set(tbodyId, { columns, redraw });
}

/** The rows, in the order this table is currently sorted. Unsorted → untouched. */
export function rowsFor(tbodyId, rows) {
  const entry = registered.get(tbodyId);
  const state = sorted.get(tbodyId);
  if (!entry || !state?.key) return rows;
  return sortRows(rows, entry.columns[state.key], state.dir);
}

/** The arrow and the direction said out loud. Called after every redraw, because a
 *  freshly built `<tbody>` does not remember that its column is sorted. */
export function markTable(tbodyId) {
  const table = document.getElementById(tbodyId)?.closest('table');
  if (!table) return;
  const state = sorted.get(tbodyId) || { key: null, dir: 1 };
  table.querySelectorAll('button[data-sort]').forEach((button) => {
    const heading = button.closest('th');
    const on = button.dataset.sort === state.key;
    heading.setAttribute('aria-sort', on ? (state.dir === 1 ? 'ascending' : 'descending') : 'none');
    heading.classList.toggle('sorted', on);
    button.querySelector('.sort-mark').textContent = on ? (state.dir === 1 ? '\u25B2' : '\u25BC') : '';
  });
}

/** A heading was clicked. The same heading again turns it round; a different one
 *  starts ascending. Returns false when that column cannot be sorted. */
export function sortBy(tbodyId, key) {
  const entry = registered.get(tbodyId);
  if (!entry?.columns[key]) return false;
  const state = sorted.get(tbodyId) || { key: null, dir: 1 };
  sorted.set(tbodyId, { key, dir: key === state.key ? -state.dir : 1 });
  entry.redraw();
  return true;
}

// One listener for every table. A table that has registered under this tbody is the
// only kind that reacts, so a heading in a table nobody registered stays inert
// rather than throwing.
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('button[data-sort]');
  if (!button) return;
  const tbodyId = button.closest('table')?.querySelector('tbody')?.id;
  if (tbodyId) sortBy(tbodyId, button.dataset.sort);
});

// ---- the three-dot menu ----------------------------------------------------
// Every row's actions, wherever they are: machines, work orders, spare parts,
// maintenance, users, due soon. One row of buttons per row made a table of twenty
// look like a toolbar.

const menuIcons = {
  view: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  add: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  print: '<path d="M6 9V3h12v6M6 18H4V9h16v9h-2M6 14h12v7H6zM17 11h.01"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4"/>',
  close: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  reopen: '<path d="M4 12a8 8 0 1 0 2-5.3M4 4v4h4"/>',
  history: '<path d="M4 12a8 8 0 1 0 2-5.3M4 4v4h4M12 8v4l3 2"/>',
  retire: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  restore: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>',
  delete: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7"/>',
};
export function menuItem(label, onclick, { danger = false, icon = null } = {}) {
  const svg = menuIcons[icon] ? `<svg class="menu-icon" aria-hidden="true" viewBox="0 0 24 24">${menuIcons[icon]}</svg>` : '';
  return `<button type="button"${danger ? ' class="danger"' : ''} onclick="${onclick}">${svg}${label}</button>`;
}

/** @param what  what the row is about, for the button's accessible name */
export function rowMenu(what, items) {
  return `<td class="cell-actions"><details class="row-menu">
      <summary aria-label="Actions for ${esc(what)}">&#8943;</summary>
      <div class="menu">${items.filter(Boolean).join('')}</div>
    </details></td>`;
}

// A menu closes when you pick something from it, and when you click anywhere else.
// A `<details>` open in a table row is otherwise the kind of thing that stays open
// behind the next dialog.
export const closeMenus = () => document.querySelectorAll('details.row-menu[open]')
  .forEach((d) => d.removeAttribute('open'));

document.addEventListener('click', (event) => {
  const item = event.target.closest('.row-menu .menu button');
  if (item) closeMenus();
  else if (!event.target.closest('.row-menu')) closeMenus();
});

// The menu is `position: fixed`, so its place is worked out when it opens: below the
// three dots, right-aligned to them, and lifted left on the last column so it cannot
// run off the screen.
document.addEventListener('toggle', (event) => {
  const details = event.target;
  if (!details.classList?.contains('row-menu') || !details.open) return;
  const dot = details.querySelector('summary').getBoundingClientRect();
  const list = details.querySelector('.menu');
  list.style.top = `${dot.bottom + 6}px`;
  list.style.left = `${Math.max(8, Math.min(window.innerWidth - list.offsetWidth - 8, dot.right - list.offsetWidth))}px`;
}, true);

// A fixed menu would stay behind while the page moves under it.
window.addEventListener('scroll', closeMenus, true);
window.addEventListener('resize', closeMenus);
