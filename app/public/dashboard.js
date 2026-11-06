// The dashboard: what needs attention, on the screen you land on.
//
// A separate file for the same reason as the shell — the readability promise.
// Everything here is presentation; the counts arrive already computed from
// /api/dashboard, because a number the database knows should not be recomputed
// in the browser where nothing tests it.

import { stackedBars, legend } from './charts.js';

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

// Money on an axis does not need cents; a bar's tooltip does not need them
// either, but 12.50 must not become 13.
const money = (n) => {
  const v = Number(n || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

/** The last six months, as two charts. Empty until something has been closed —
 *  a chart of six zeroes looks like a broken chart, so it is replaced by a
 *  sentence that says what to do instead. */
function chartsRow(charts) {
  const trend = Array.isArray(charts?.trend) ? charts.trend : [];
  const anyWork = trend.some((m) => Number(m.closed) > 0 || Number(m.total) > 0);
  if (!trend.length || !anyWork) {
    return `<div class="card"><p class="dash-empty">
      No finished work in the last six months yet. Close a work order and the
      trend appears here.</p></div>`;
  }

  const labels = trend.map((m) => m.label);
  const closed = [{ name: 'Jobs closed', values: trend.map((m) => m.closed), tone: 'brand' }];
  const cost = [
    { name: 'Parts', values: trend.map((m) => m.parts_cost), tone: 'soft' },
    { name: 'Labour', values: trend.map((m) => m.labour_cost), tone: 'brand' },
  ];

  return `<div class="charts-grid">
    <div class="card chart-card">
      <div class="chart-head"><span class="chart-title">Jobs closed</span>
        <span class="chart-note">last 6 months</span></div>
      ${stackedBars({ labels, series: closed, title: 'Jobs closed per month',
        format: (n) => String(Math.round(Number(n) || 0)) })}
      ${legend(closed)}
    </div>
    <div class="card chart-card">
      <div class="chart-head"><span class="chart-title">What it cost</span>
        <span class="chart-note">parts + labour</span></div>
      ${stackedBars({ labels, series: cost, title: 'Cost per month', format: money })}
      ${legend(cost)}
    </div>
  </div>`;
}

/** Render the four cards and the charts. `data` is the endpoint's response verbatim. */
export function renderDashboard(container, data) {
  if (!container) return;
  container.innerHTML = `<div class="dash-grid">${
    CARD_ORDER.map((c) => card(c, data?.[c.key])).join('')
  }</div>${chartsRow(data?.charts)}`;

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
