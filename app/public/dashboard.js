// The dashboard: what needs attention, on the screen you land on.
//
// A separate file for the same reason as the shell — the readability promise.
// Everything here is presentation; the counts arrive already computed from
// /api/dashboard, because a number the database knows should not be recomputed
// in the browser where nothing tests it.

const escapeHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const CARD_ORDER = [
  { key: 'work_orders', label: 'Open work orders', empty: 'No work orders open. Nothing needs doing.' },
  { key: 'due_soon', label: 'Maintenance due', empty: 'No maintenance due in the next 7 days.' },
  { key: 'low_stock', label: 'Parts to reorder', empty: 'Every part is above its reorder level.' },
  { key: 'machines', label: 'Machines down', empty: 'Every machine is running.' },
];

/** One row per item. Each shape is different, so the renderer picks fields by
 *  card rather than pretending four lists have one shape. */
function itemRow(key, item) {
  if (key === 'work_orders') {
    return `<li><span class="dash-item-main">${escapeHtml(item.title)}</span>
      <span class="dash-item-meta">${escapeHtml(item.equipment_name)}</span></li>`;
  }
  if (key === 'due_soon') {
    const days = Number(item.days_left);
    const when = days < 0 ? `${Math.abs(days)} d overdue` : days === 0 ? 'today' : `in ${days} d`;
    return `<li><span class="dash-item-main">${escapeHtml(item.task)}</span>
      <span class="dash-item-meta">${escapeHtml(item.equipment_name)} · ${escapeHtml(when)}</span></li>`;
  }
  if (key === 'low_stock') {
    return `<li><span class="dash-item-main">${escapeHtml(item.name)}</span>
      <span class="dash-item-meta">${Number(item.qty)} left, reorder at ${Number(item.reorder_level)}</span></li>`;
  }
  return `<li><span class="dash-item-main">${escapeHtml(item.name)}</span>
    <span class="dash-item-meta">${escapeHtml(item.status)}</span></li>`;
}

function card({ key, label, empty }, section) {
  const count = Number(section?.count ?? 0);
  const items = Array.isArray(section?.items) ? section.items : [];
  const more = count > items.length
    ? `<p class="dash-more">and ${count - items.length} more</p>`
    : '';
  // A card with a count of zero and a card that failed to load must not look the
  // same, so the empty sentence is the server's zero, never a missing section.
  const body = count === 0
    ? `<p class="dash-empty">${escapeHtml(empty)}</p>`
    : `<ul class="dash-list">${items.map((i) => itemRow(key, i)).join('')}</ul>${more}`;

  return `<div class="card dash-card${count > 0 ? ' has-items' : ''}">
    <div class="dash-head">
      <span class="dash-label">${escapeHtml(label)}</span>
      <span class="dash-count">${count}</span>
    </div>
    ${body}
    <button class="dash-link" type="button" data-goto="${escapeHtml(section?.href || '#')}">
      Open ${escapeHtml(label.toLowerCase())}
    </button>
  </div>`;
}

/** Render the four cards. `data` is the endpoint's response verbatim. */
export function renderDashboard(container, data) {
  if (!container) return;
  container.innerHTML = `<div class="dash-grid">${
    CARD_ORDER.map((c) => card(c, data?.[c.key])).join('')
  }</div>`;

  container.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.goto.replace('#', '');
      if (typeof window.showPage === 'function') window.showPage(key);
    });
  });
}

/** The load failed. Say so — four zeroed cards would read as "all is well",
 *  which is the one thing a dashboard must never lie about. */
export function renderDashboardError(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="card dash-error">
    <p><strong>Could not load the dashboard.</strong></p>
    <p class="muted">${escapeHtml(message || 'The server did not respond.')}</p>
    <button class="primary" type="button" data-retry>Try again</button>
  </div>`;
  container.querySelector('[data-retry]')?.addEventListener('click', () => {
    if (typeof window.loadDashboard === 'function') window.loadDashboard();
  });
}
