// Upload media/documents into owner-scoped temporary storage before saving a part.
let loaded = [], generation = 0;
const sessions = { p: 0, pe: 0 };
export const partSession = (prefix) => sessions[prefix];
export const currentPartSession = (prefix, session) => sessions[prefix] === session;
export function resetPartAttachments(prefix) {
  ++sessions[prefix];
  if (prefix === 'pe') { loaded = []; ++generation; }
  $(`#${prefix}-media`).value = ''; $(`#${prefix}-documents`).value = '';
  $(`#${prefix}-attachments-list`).innerHTML = '';
  $(`#${prefix}-attachments-status`).textContent = '';
  $(`#${prefix}-attachments-panel`).open = false;
  $(`#${prefix}-save`).disabled = false;
}
export async function loadPartAttachments(partId) {
  resetPartAttachments('pe'); const run = generation;
  $('#pe-save').disabled = true; $('#pe-attachments-status').textContent = 'Loading attachments…';
  try {
    const rows = await api(`/parts/${partId}/attachments`);
    if (run !== generation) return;
    loaded = rows;
    $('#pe-attachments-list').innerHTML = rows.map((f) => {
      const url = `/api/parts/${Number(partId)}/attachments/${Number(f.id)}`;
      const media = f.kind === 'media' ? (f.video ? `<video src="${url}" controls preload="metadata" playsinline></video>` : `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${esc(f.name)}" loading="lazy"></a>`) : '';
      return `<div class="part-attachment-card">${media}<a href="${url}" ${f.kind === 'report' ? '' : 'target="_blank" rel="noopener"'}>${esc(f.name)}</a><label><input type="checkbox" value="${Number(f.id)}" /> Remove on save</label></div>`;
    }).join('');
    $('#pe-attachments-status').textContent = rows.length ? `${rows.length} attached ${rows.length === 1 ? 'file' : 'files'}` : 'No attachments yet.';
    $('#pe-save').disabled = false;
  } catch (e) {
    if (run !== generation) return;
    $('#pe-attachments-status').textContent = `Could not load attachments: ${e.message}. Close and reopen the editor to retry.`;
  }
}
export async function partAttachmentsForSave(prefix, dialog, uploaded, session) {
  const media = Array.from($(`#${prefix}-media`).files || []), docs = Array.from($(`#${prefix}-documents`).files || []);
  const removed = prefix === 'pe' ? Array.from(document.querySelectorAll('#pe-attachments-list input:checked')).map((e) => Number(e.value)) : [];
  if ((prefix === 'pe' ? loaded.length - removed.length : 0) + media.length + docs.length > 20) throw new Error('Choose up to 20 attachments per part.');
  const result = { media_upload_ids: [], document_upload_ids: [] };
  for (const [kind, files, key] of [['media', media, 'media_upload_ids'], ['report', docs, 'document_upload_ids']]) {
    for (const file of files) {
      $(`#${prefix}-attachments-status`).textContent = `Uploading ${uploaded.length + 1} of ${media.length + docs.length}…`;
      const r = await fetch(`/api/uploads?kind=${kind}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': file.type || 'application/octet-stream', 'x-upload-name': encodeURIComponent(file.name) }, body: file });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Could not upload attachment');
      uploaded.push(data.id); result[key].push(data.id);
      if (!currentPartSession(prefix, session) || !$(dialog).open) throw new Error('Cancelled');
    }
  }
  if (prefix === 'pe') result.remove_attachment_ids = removed;
  return result;
}
export async function discardPartUploads(tokens) {
  await Promise.all(tokens.map((token) => fetch(`/api/uploads/${token}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {})));
}

$('#parts-form').addEventListener?.('close', () => resetPartAttachments('p'));
$('#part-edit').addEventListener?.('close', () => resetPartAttachments('pe'));
