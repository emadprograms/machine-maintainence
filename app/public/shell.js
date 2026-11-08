// The application shell: the sidebar that navigates between screens.
//
// Kept separate from app.js on purpose. app.js is the screen logic and it is
// already over 400 lines; the project's core promise is that a beginner can read
// every file in one sitting, so a new surface gets a new file rather than another
// three hundred lines in the one that is already longest.

// One icon per screen, drawn rather than fetched. Inline SVG keeps the app offline
// with no image files and no icon font, and a path is readable as text.
// A key here must match a `key` in app.js PAGES, and every page must have one:
// a missing entry renders an empty <svg>, which looks like a layout bug rather
// than a missing picture. The smoke test compares the two lists in both
// directions for that reason.
const ICONS = {
  dashboard: '<path d="M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z"/>',
  due: '<path d="M12 8v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/>',
  equipment: '<path d="M4 7h16v10H4zM7 7V5h10v2M9 17v3M15 17v3"/>',
  work: '<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5"/>',
  // History: an arrow turning back on itself — looking at what already happened.
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/>',
  // Report: bars over a baseline — the month, added up.
  report: '<path d="M4 20v-9M10 20V5M16 20v-6M20 20H3"/>',
  pm: '<path d="M14 3l-2 6h4l-6 12 2-8H8z"/>',
  parts: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>',
  users: '<path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M17 12a2.5 2.5 0 1 0 0-5M22 20c0-2.5-2-4-5-4"/>',
  backup: '<path d="M12 3v12M7 10l5 5 5-5M4 19h16"/>',
};

// Cosmetic state, so it lives in the browser and never touches the server. If
// storage is unavailable — private mode, a locked-down profile — the sidebar
// simply starts expanded. A broken preference must not break the app.
const COLLAPSE_KEY = 'mm.sidebar.collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch { /* the preference is a nicety; failing to save it is not an error */ }
}

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ''}</svg>`;
}

/** Build the sidebar. `pages` is the same array app.js uses for the screens, so
 *  the navigation cannot drift from the list of screens that exist. */
export function renderShell({ pages, current, onNavigate }) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const collapsed = readCollapsed();
  sidebar.classList.toggle('collapsed', collapsed);

  const entries = pages.map((p) => `
    <button class="side-link${p.key === current ? ' on' : ''}"
            data-page="${p.key}"
            aria-label="${p.label}"
            ${p.key === current ? 'aria-current="page"' : ''}
            title="${p.label}">
      ${icon(p.key)}
      <span class="side-label">${p.label}</span>
    </button>`).join('');

  sidebar.innerHTML = `
    <div class="side-brand">
      <span class="side-mark">MM</span>
      <span class="side-label">Machine Maintenance</span>
    </div>
    <button class="side-toggle" type="button"
            aria-expanded="${!collapsed}"
            aria-controls="sidebar"
            aria-label="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
            title="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
           stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <path d="M15 6l-6 6 6 6"/>
      </svg>
      <span class="side-label">Collapse</span>
    </button>
    <nav class="side-nav" aria-label="Sections">${entries}</nav>`;

  // Clicking outside the sidebar should not navigate; each entry stops here.
  sidebar.querySelectorAll('.side-link').forEach((btn) => {
    btn.addEventListener('click', () => onNavigate(btn.dataset.page));
  });

  sidebar.querySelector('.side-toggle').addEventListener('click', () => {
    const nowCollapsed = !sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed', nowCollapsed);
    writeCollapsed(nowCollapsed);
    const toggle = sidebar.querySelector('.side-toggle');
    const action = nowCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
    toggle.setAttribute('aria-expanded', String(!nowCollapsed));
    toggle.setAttribute('aria-label', action);
    toggle.setAttribute('title', action);
  });
}

/** Move the highlight without rebuilding: cheaper, and it keeps focus where the
 *  user put it. */
export function markCurrent(key) {
  document.querySelectorAll('#sidebar .side-link').forEach((btn) => {
    const on = btn.dataset.page === key;
    btn.classList.toggle('on', on);
    if (on) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

// Ctrl/Cmd+B toggles the rail, the same shortcut editors use for their own
// sidebars. Discoverability comes from the visible button; this is for speed.
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
    const toggle = document.querySelector('#sidebar .side-toggle');
    if (toggle) { event.preventDefault(); toggle.click(); }
  }
});
