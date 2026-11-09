// Timeline, new stage and admin correction share one spacious dialog. The server
// remains authoritative about the latest stage, stock, photos and machine state.
import { resetStageParts, loadStageParts, stagePartsForSave, setStageParts, hasStagePartsDraft, groupStageParts, formatStagePrice } from './stage-parts.js';
import { resetStageGallery, historyPhotos, existingPhotos, updateNewPhotos } from './stage-gallery.js';
import { zoneDateTime, getDisplayZone } from './time-zone.js';
const timeLabel = (stamp) => stamp ? `${zoneDateTime(stamp) || stamp} ${getDisplayZone()}` : 'Date not recorded';
let refreshAfterUpdate = () => {}, rememberPeople = () => {};
let updatingWork = null, updateJob = null, editingStage = null, latestStage = null;
let updateRun = 0, updateLoad = 0, updateEditing = false, stateReady = false;
let stateTouched = false, currentRunning = false;

function showToggle(running) {
  $('#wa-running').checked = !!running;
  $('#wa-running-label').textContent = running ? 'Running' : 'Out of service';
}
export function stageToggleChanged() { stateTouched = true; showToggle($('#wa-running').checked); }

export async function openWorkUpdates(job, viewOnly = false, refresh = () => {}, onPeople = () => {}) {
  if (!job) return;
  refreshAfterUpdate = refresh; rememberPeople = onPeople;
  updatingWork = job.id; updateJob = job; editingStage = null; latestStage = null;
  resetStageGallery(job.id);
  ++updateRun; stateReady = false; stateTouched = false;
  const editing = !viewOnly && job.status !== 'done';
  updateEditing = editing;
  $('#work-assign').classList?.toggle('stage-view-only', viewOnly);
  $('#work-assign-title').textContent = editing ? (job.status === 'open' ? 'Start the job' : 'Add an update') : 'Work order updates';
  $('#work-assign-what').textContent = `${job.code ? `${job.code} · ` : ''}${job.equipment_name} — ${job.title}`;
  $('#wa-entry').hidden = !editing;
  $('#wa-go').hidden = !editing;
  $('#wa-go').textContent = 'Save update'; $('#wa-cancel').textContent = editing ? 'Cancel' : 'Close';
  $('#wa-delete').hidden = true;
  $('#wa-history-panel').open = viewOnly; $('#wa-parts-panel').open = false; $('#wa-photos-panel').open = false; $('#wa-report-panel').open = false;
  $('#wa-history-label').textContent = viewOnly ? 'Timeline' : 'Previous updates';
  $('#wa-history-count').textContent = 'Loading…'; $('#wa-photos-summary').textContent = 'Optional · Attach up to 5 files';
  $('#wa-photo-selection').textContent = ''; $('#wa-scroll').scrollTop = 0;
  $('#wa-message').value = ''; $('#wa-hours').value = ''; $('#wa-photos').value = '';
  $('#wa-existing-photos').innerHTML = '';
  $('#wa-report').value = ''; $('#wa-report-keep').hidden = true; $('#wa-keep-report').checked = true; $('#wa-report-name').textContent = '';
  $('#wa-running-help').textContent = 'The state you record becomes the machine’s latest status.';
  showToggle(false); $('#wa-running-label').textContent = 'Loading…';
  resetStageParts();
  if (editing) loadStageParts();
  $('#wa-owner-field').hidden = !(editing && (job.status === 'open' || !job.assigned_to));
  $('#wa-owner').innerHTML = '<option value="">Loading people…</option>';
  $('#wa-owner').disabled = true;
  openForm('work-assign');
  $('#work-assign-title').focus?.({ preventScroll: true });
  $('#wa-scroll').scrollTop = 0;
  return retryWorkUpdateLoading();
}

function timeline(updates) {
  const admin = window.me?.role === 'admin', job = updateJob;
  const report = `<article class="update-entry timeline-report"><div class="update-top"><strong>Problem reported</strong></div>
    <small class="update-meta">${esc(timeLabel(job.created_at))}${job.reported_by ? ` · Reported by ${esc(job.reported_by)}` : ''}</small>
    <p><strong>${esc(job.title)}</strong></p>${job.priority ? `<small>Priority: ${esc(job.priority)}</small>` : ''}${job.notes ? `<p>${esc(job.notes)}</p>` : ''}
    ${job.photo ? `<div class="stage-photo-grid"><button type="button" class="stage-thumbnail" onclick="previewFaultPhoto(${/\.(mp4|mov|webm)$/i.test(job.photo)})" aria-label="Preview fault media">${/\.(mp4|mov|webm)$/i.test(job.photo) ? `<video src="/api/work-orders/${Number(job.id)}/photo" preload="metadata" muted playsinline></video>` : `<img src="/api/work-orders/${Number(job.id)}/photo" alt="" loading="lazy">`}<span>Fault media</span></button></div>` : ''}</article>`;
  const stages = updates.map((u, i) => `<article class="update-entry"><div class="update-top"><div><strong>Stage ${Number(u.stage)}</strong>${i === updates.length - 1 ? '<span class="stage-latest">Latest</span>' : ''}</div>
      ${admin && i === updates.length - 1 ? `<button type="button" class="stage-row-action stage-edit-action" onclick="editLatestStage(${Number(u.id)})" aria-label="Edit latest stage" title="Edit latest stage"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4"/></svg></button>` : ''}</div>
    <small class="update-meta">${esc(timeLabel(u.created_at))} · ${esc(u.author)} · ${Number(u.hours)} ${Number(u.hours) === 1 ? 'hour' : 'hours'}${u.edited_by ? ` · Edited by ${esc(u.edited_by)}` : ''}</small>
    <p>${esc(u.message)}</p>${u.machine_running == null ? '' : `<small>Machine: ${u.machine_running ? 'running' : 'out of service'}</small>`}
    ${groupStageParts(u.parts).map((p) => `<p class="hint">${esc(p.part_name)} × ${Number(p.qty)} · ${formatStagePrice(p.unit_price)} each</p>`).join('')}
    ${historyPhotos(u)}${u.report ? `<p><a href="/api/work-orders/${Number(job.id)}/updates/${Number(u.id)}/report">Job report: ${esc(u.report.original_name)}</a></p>` : ''}</article>`).join('');
  const closure = job.status === 'done' ? `<article class="update-entry timeline-closed"><div class="update-top"><strong>Job closed</strong></div>
    <small class="update-meta">${esc(timeLabel(job.closed_at))}</small>
    ${job.resolution ? `<p>${esc(job.resolution)}</p>` : ''}</article>` : '';
  return report + (stages || '<p class="hint">No updates yet.</p>') + closure;
}

// Independent lookups prevent a failed history, people or machine request from
// blanking the other controls. Saving waits for the current machine state.
export async function retryWorkUpdateLoading() {
  if (!updatingWork || !updateJob) return;
  const run = updateRun, load = ++updateLoad, workId = updatingWork, job = updateJob;
  const editing = updateEditing, choose = editing && !editingStage && (job.status === 'open' || !job.assigned_to);
  const needsState = editing || window.me?.role === 'admin';
  const selected = $('#wa-owner').value || (job.assigned_to ? String(job.assigned_to) : '');
  let historyReady = false, peopleReady = !choose, machineReady = !needsState;
  stateReady = !needsState;
  const failures = [];
  const current = () => run === updateRun && load === updateLoad;
  const refresh = () => {
    if (!current()) return;
    const pending = !historyReady || !peopleReady || !machineReady;
    $('#wa-load-status').textContent = failures.length ? failures.join(' ') : (pending ? 'Loading updates, people and machine state…' : '');
    $('#wa-retry').hidden = failures.length === 0;
    $('#wa-go').disabled = !(editing || editingStage) || pending || failures.length > 0;
  };
  $('#wa-go').disabled = true; $('#wa-retry').hidden = true;
  $('#wa-running').disabled = needsState;
  formError('work-assign', '');
  if (job.status === 'open' && job.current_stage === null) $('#wa-history').innerHTML = timeline([]);
  else $('#wa-history').textContent = 'Loading updates…';
  if (choose) { $('#wa-owner').innerHTML = '<option value="">Loading people…</option>'; $('#wa-owner').disabled = true; }
  refresh();
  const history = api(`/work-orders/${workId}/updates`).then((updates) => {
    if (!current()) return;
    if (!Array.isArray(updates)) throw new Error('The server returned an invalid updates list. Restart the app after updating, then retry');
    latestStage = updates.at(-1) || null;
    $('#wa-history-count').textContent = updates.length ? `${updates.length} ${updates.length === 1 ? 'update' : 'updates'}` : 'No updates yet';
    $('#wa-history').innerHTML = timeline(updates);
    if (!editingStage) $('#wa-stage-title').textContent = `Stage ${latestStage ? Number(latestStage.stage) + 1 : 1}`;
    historyReady = true; refresh();
  }).catch((e) => {
    if (!current()) return;
    $('#wa-history').textContent = ''; $('#wa-history-count').textContent = 'Unavailable';
    failures.push(e.status === 404 && e.nonJson
      ? 'Updates are unavailable on this server. Restart the app after updating, then retry.'
      : `Could not load updates: ${e.message}.`);
    refresh();
  });
  const people = choose ? api('/users/assignable').then((users) => {
    if (!current()) return;
    rememberPeople(users);
    $('#wa-owner').innerHTML = `<option value="">— choose somebody —</option>${users.map((u) =>
      `<option value="${u.id}">${esc(u.name)}</option>`).join('')}`;
    if (selected && users.some((u) => String(u.id) === selected)) $('#wa-owner').value = selected;
    $('#wa-owner').disabled = users.length === 0;
    if (!users.length) failures.push('No accounts are available to assign. Ask an admin to add one.');
    peopleReady = users.length > 0; refresh();
  }).catch((e) => {
    if (!current()) return;
    $('#wa-owner').innerHTML = '<option value="">Could not load people</option>';
    failures.push(`Could not load people: ${e.message}.`); refresh();
  }) : Promise.resolve();
  const machine = needsState ? api('/equipment').then((machines) => {
    if (!current()) return;
    const found = machines.find((m) => Number(m.id) === Number(job.equipment_id));
    if (!found) throw new Error('Machine not found');
    currentRunning = found.status === 'active';
    if (!stateTouched) showToggle(currentRunning);
    $('#wa-running').disabled = false;
    stateReady = true; machineReady = true; refresh();
  }).catch((e) => {
    if (!current()) return;
    if (!stateTouched) $('#wa-running-label').textContent = 'Unavailable';
    failures.push(`Could not load machine state: ${e.message}.`); refresh();
  }) : Promise.resolve();
  await Promise.all([history, people, machine]);
}

export function editLatestStage(stageId) {
  if (window.me?.role !== 'admin' || !latestStage || Number(stageId) !== Number(latestStage.id)) return;
  if (editingStage) return; // don't replace an in-progress correction with the old values
  if (!stateReady || !$('#wa-retry').hidden) return formError('work-assign', 'Reload the latest history and machine state before editing.');
  const ownerChanged = !$('#wa-owner-field').hidden && $('#wa-owner').value !== String(updateJob?.assigned_to || '');
  if (($('#wa-message').value.trim() || $('#wa-hours').value || $('#wa-photos').files?.length
      || $('#wa-report').files?.length || hasStagePartsDraft() || stateTouched || ownerChanged)
      && !window.confirm('Discard the new update draft and edit the latest stage instead?')) return;
  editingStage = latestStage;
  $('#wa-history-panel').open = false; $('#wa-scroll').scrollTop = 0;
  $('#wa-parts-panel').open = Boolean(editingStage.parts?.length);
  $('#wa-photos-panel').open = Boolean(editingStage.photos?.length);
  $('#wa-report-panel').open = Boolean(editingStage.report);
  stateTouched = true;
  $('#work-assign-title').textContent = 'Edit latest stage';
  $('#wa-stage-title').textContent = `Stage ${Number(editingStage.stage)}`;
  $('#wa-entry').hidden = false; $('#wa-go').hidden = false; $('#wa-go').disabled = false;
  $('#wa-go').textContent = 'Save changes'; $('#wa-cancel').textContent = 'Cancel'; $('#wa-delete').hidden = false;
  $('#wa-owner-field').hidden = true;
  $('#wa-message').value = editingStage.message; $('#wa-hours').value = String(editingStage.hours);
  $('#wa-photos').value = ''; $('#wa-report').value = '';
  $('#wa-report-keep').hidden = !editingStage.report; $('#wa-keep-report').checked = true;
  $('#wa-report-name').textContent = editingStage.report ? `Current report: ${editingStage.report.original_name}. Selecting a new file replaces it.` : '';
  showToggle(editingStage.machine_running == null ? currentRunning : Boolean(editingStage.machine_running));
  $('#wa-running-help').textContent = 'This is the state recorded during this stage. A newer report may determine the current state.';
  $('#wa-existing-photos').innerHTML = existingPhotos(editingStage);
  resetStageParts(); setStageParts(editingStage.parts); loadStageParts(); stagePhotoSelectionChanged();
  $('#wa-message').focus?.({ preventScroll: true }); $('#wa-scroll').scrollTop = 0;
  formError('work-assign', '');
}

export function stagePhotoSelectionChanged() {
  const files = Array.from($('#wa-photos').files || []);
  const kept = document.querySelectorAll('#wa-existing-photos input[type="checkbox"]:checked').length;
  const count = files.length + kept;
  $('#wa-photos-summary').textContent = count ? `${count} ${count === 1 ? 'file' : 'files'} selected` : 'Optional · Attach up to 5 files';
  updateNewPhotos(files);
  $('#wa-photo-selection').textContent = files.length > 5 ? 'Only up to five files can be added.' : '';
}

async function uploadStageFile(file, kind) {
  const response = await fetch(`/api/uploads?kind=${kind}`, { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': file.type || 'application/octet-stream', 'x-upload-name': encodeURIComponent(file.name) }, body: file });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not upload attachment');
  return result.id;
}

export async function startAssigned() {
  if (!updatingWork || !updateJob || $('#wa-go').disabled) return;
  const run = updateRun, workId = updatingWork, job = updateJob, stage = editingStage, refresh = refreshAfterUpdate;
  const message = $('#wa-message').value.trim(), hours = $('#wa-hours').value, owner = $('#wa-owner').value;
  const photos = Array.from($('#wa-photos').files || []);
  const keep = stage ? Array.from(document.querySelectorAll('#wa-existing-photos input[type="checkbox"]:checked')).map((p) => Number(p.value)) : [];
  if (!message) return formError('work-assign', 'Write an update for this stage.');
  if (hours === '' || !Number.isFinite(Number(hours)) || Number(hours) < 0)
    return formError('work-assign', 'Enter the time spent in hours.');
  const choose = !stage && (job.status === 'open' || !job.assigned_to);
  if (choose && !owner) return formError('work-assign', 'Choose who is doing this job.');
  if (photos.length + keep.length > 5) {
    $('#wa-photos-panel').open = true;
    return formError('work-assign', 'Choose up to five photos or videos.');
  }
  $('#wa-go').disabled = true;
  const uploaded = [];
  try {
    let parts;
    try { parts = stagePartsForSave(); } catch (error) { $('#wa-parts-panel').open = true; throw error; }
    const body = { message, hours, upload_ids: [], machine_running: $('#wa-running').checked };
    const report = $('#wa-report').files?.[0], total = photos.length + (report ? 1 : 0);
    for (const file of photos) {
      if (updateRun === run) $('#wa-load-status').textContent = `Uploading attachment ${uploaded.length + 1} of ${total}…`;
      const token = await uploadStageFile(file, 'media'); uploaded.push(token); body.upload_ids.push(token);
      if (updateRun !== run || !$('#work-assign').open) throw new Error('Update cancelled');
    }
    if (report) {
      if (updateRun === run) $('#wa-load-status').textContent = `Uploading attachment ${uploaded.length + 1} of ${total}…`;
      body.report_upload_id = await uploadStageFile(report, 'report'); uploaded.push(body.report_upload_id);
    }
    if (stage) body.remove_report = !$('#wa-keep-report').checked;
    if (updateRun !== run || !$('#work-assign').open) throw new Error('Update cancelled');
    if (parts.length || stage) body.parts = parts;
    if (choose) body.assigned_to = Number(owner);
    if (stage) body.keep_photos = keep;
    const result = await api(`/work-orders/${workId}/updates${stage ? `/${stage.id}` : ''}`,
      { method: stage ? 'PUT' : 'POST', body: JSON.stringify(body) });
    uploaded.length = 0;
    if (result.warning) alert(result.warning);
    if (updateRun === run) { updatingWork = null; updateJob = null; formDone('work-assign'); }
    await refresh();
  } catch (e) {
    if (updateRun === run && $('#work-assign').open) { formError('work-assign', e.message); $('#wa-go').disabled = false; }
  } finally {
    if (updateRun === run) $('#wa-load-status').textContent = '';
    await Promise.all(uploaded.map((token) => fetch(`/api/uploads/${token}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {})));
  }
}

export async function deleteLatestStage() {
  if (!editingStage || !updatingWork || window.me?.role !== 'admin' || $('#wa-go').disabled) return;
  if (!window.confirm(`Permanently delete Stage ${editingStage.stage}? Its photos will be deleted and its parts returned to stock.`)) return;
  const run = updateRun, workId = updatingWork, stageId = editingStage.id, refresh = refreshAfterUpdate;
  $('#wa-go').disabled = true; $('#wa-delete').disabled = true;
  try {
    const result = await api(`/work-orders/${workId}/updates/${stageId}`, { method: 'DELETE' });
    if (result.warning) alert(result.warning);
    if (updateRun === run) { updatingWork = null; updateJob = null; formDone('work-assign'); }
    await refresh();
  } catch (e) {
    if (updateRun === run) { formError('work-assign', e.message); $('#wa-go').disabled = false; }
  } finally { $('#wa-delete').disabled = false; }
}

Object.assign(window, { editLatestStage, deleteLatestStage, stageToggleChanged, stagePhotoSelectionChanged });
