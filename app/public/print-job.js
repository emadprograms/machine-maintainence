// An authenticated, fresh snapshot is rendered locally: no service, library or
// data sent away. Images must finish loading before the print dialog appears.
import { zoneDateTime } from './time-zone.js';
const root = document.querySelector('#print-job'), button = document.querySelector('#print-button');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const value = (v, fallback = 'Not recorded') => v === null || v === undefined || v === '' ? fallback : esc(v);
const money = (v) => Number(v || 0).toFixed(2);
const item = (label, v) => `<div><dt>${esc(label)}</dt><dd>${value(v)}</dd></div>`;
const photo = (src, label) => `<figure><img src="${src}" alt="${esc(label)}"><figcaption>${esc(label)}</figcaption></figure>`;
const paragraphs = (v) => value(v).replace(/\n/g, '<br>');
const unitPrice = (v) => Math.round(Number(v) * 100) / 100 === Number(v) ? Number(v).toFixed(2) : String(Number(v));

function render({ job, updates, parts, rate, time_zone = 'UTC' }) {
  const stamp = (v) => v ? `${zoneDateTime(v, time_zone) || v} ${time_zone}` : null;
  const photos = (u) => (u.photos || []).map((id, i) => photo(`/api/work-orders/${job.id}/updates/${u.id}/photos/${id}`, `Stage ${u.stage} · Photo ${i + 1}`)).join('');
  const stageRows = (u) => (u.parts || []).map((p) => `<tr><td>${esc(p.part_name)}</td><td>${Number(p.qty)}</td><td>${unitPrice(p.unit_price)}</td></tr>`).join('');
  const stageMarkup = updates.map((u) => `<article class="print-stage"><div class="stage-title"><h3>Stage ${Number(u.stage)}</h3><span>${value(stamp(u.created_at))}</span></div>
    <p class="meta">${value(u.author)} · ${Number(u.hours)} ${Number(u.hours) === 1 ? 'hour' : 'hours'}${u.edited_by ? ` · Edited by ${esc(u.edited_by)}${u.edited_at ? ` on ${esc(stamp(u.edited_at))}` : ''}` : ''}</p>
    <p>${paragraphs(u.message)}</p>${u.machine_running == null ? '' : `<p class="meta">Machine: ${u.machine_running ? 'Running' : 'Out of service'}</p>`}
    ${u.parts?.length ? `<h4>Parts used in this stage</h4><table><thead><tr><th>Part</th><th>Quantity</th><th>Actual unit cost</th></tr></thead><tbody>${stageRows(u)}</tbody></table>` : ''}
    ${u.photos?.length ? `<h4>Stage photos</h4><div class="print-photos">${photos(u)}</div>` : ''}</article>`).join('');
  root.innerHTML = `<div class="print-head"><div><p class="eyebrow">WORK ORDER</p><h1>${value(job.code, `Job ${job.id}`)}</h1><p class="print-machine">${value(job.equipment_name)}</p></div><div class="status">${esc(job.status.replace('_',' '))}</div></div>
    <section><h2>Reported problem</h2><p class="problem">${paragraphs(job.title)}</p><dl class="details">${item('Priority', job.priority)}${item('Reported by', job.reported_by)}${item('Assigned to', job.assignee_name)}${item('Reported', stamp(job.created_at))}${item('Last noted machine state', job.last_reported_running == null ? 'Not reported' : job.last_reported_running ? 'Running' : 'Out of service')}</dl>
    <h3>Notes</h3><p>${paragraphs(job.notes)}</p>${job.photo ? `<h3>Fault photo</h3><div class="print-photos">${photo(`/api/work-orders/${job.id}/photo?v=${encodeURIComponent(job.photo)}`, 'Fault photo')}</div>` : ''}</section>
    <section><h2>Machine details</h2><dl class="details">${item('Machine', job.equipment_name)}${item('Barcode', job.barcode)}${item('Category', job.equipment_category)}${item('Location', job.equipment_location)}${item('Manufacturer', job.equipment_manufacturer)}</dl></section>
    <section><h2>Work updates <span class="count">${updates.length}</span></h2>${stageMarkup || '<p class="muted">No stages recorded.</p>'}</section>
    <section><h2>Parts summary</h2>${parts.length ? `<table><thead><tr><th>Part</th><th>Reference</th><th>Quantity</th><th>Total cost</th></tr></thead><tbody>${parts.map((p) => `<tr><td>${esc(p.name)}</td><td>${value(p.reference, '—')}</td><td>${Number(p.qty)}</td><td>${money(p.display_cost)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No parts recorded.</p>'}</section>
    <section><h2>Closure and totals</h2><dl class="details">${item('Closed', stamp(job.closed_at))}${item('Checked by', job.verified_by)}${item('Total labour hours', job.effective_hours)}${item('Hourly rate', money(rate))}${item('Parts cost', money(job.parts_cost_display))}${item('Total cost', money(job.total_cost))}</dl><h3>Closing note / historical resolution</h3><p>${paragraphs(job.resolution)}</p></section>`;
  document.title = `${job.code || `Job ${job.id}`} — Work order`;
}

async function waitForImages() {
  const images = [...root.querySelectorAll('img')];
  await Promise.all(images.map((img) => new Promise((resolve) => {
    const done = () => {
      if (!img.naturalWidth) { const notice = document.createElement('p'); notice.className = 'image-error'; notice.textContent = `${img.alt} unavailable`; img.replaceWith(notice); }
      resolve();
    };
    if (img.complete) return done();
    img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true });
  })));
}

button.addEventListener('click', () => window.print());
try {
  const id = new URLSearchParams(location.search).get('id');
  if (!/^\d+$/.test(id || '') || Number(id) < 1) throw new Error('Invalid work order number.');
  const response = await fetch(`/api/work-orders/${id}/print`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(response.status === 401 ? 'Please sign in in the main app, then reload this page.' : 'Could not load this work order.');
  render(await response.json());
  let timer;
  try { await Promise.race([waitForImages(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Photos are taking too long to load. Reload this page before printing.')), 15000); })]); }
  finally { clearTimeout(timer); }
  button.disabled = false;
  window.print();
} catch (error) { root.innerHTML = `<p class="image-error" role="alert">${esc(error.message)}</p>`; }
