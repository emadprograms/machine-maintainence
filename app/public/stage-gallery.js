// Images are shown in an accessible in-app preview, never a new browser tab.
let workId = null, selectedUrls = [];
const url = (stage, photo) => `/api/work-orders/${Number(workId)}/updates/${Number(stage)}/photos/${Number(photo)}`;
export function resetStageGallery(id) {
  workId = id;
  selectedUrls.forEach((u) => URL.revokeObjectURL(u)); selectedUrls = [];
  $('#wa-new-photos').innerHTML = '';
}
function thumbnail(src, caption, action) {
  return `<button type="button" class="stage-thumbnail" onclick="${action}" aria-label="Preview ${esc(caption)}" title="Preview ${esc(caption)}"><img src="${src}" alt="" loading="lazy"><span>${esc(caption)}</span></button>`;
}
export function historyPhotos(stage) {
  const items = (stage.photos || []).map((photo, i) => thumbnail(url(stage.id, photo), `Photo ${i + 1}`, `previewStagePhoto(${Number(stage.id)}, ${Number(photo)}, ${i + 1})`));
  return items.length ? `<div class="stage-photo-grid">${items.join('')}</div>` : '';
}
export function existingPhotos(stage) {
  return (stage.photos || []).map((photo, i) => `<div class="stage-photo-card">${thumbnail(url(stage.id, photo), `Photo ${i + 1}`, `previewStagePhoto(${Number(stage.id)}, ${Number(photo)}, ${i + 1})`)}<label><input type="checkbox" value="${Number(photo)}" checked onchange="stagePhotoSelectionChanged()" /> Keep photo ${i + 1}</label></div>`).join('');
}
export function updateNewPhotos(files) {
  selectedUrls.forEach((u) => URL.revokeObjectURL(u)); selectedUrls = [];
  const html = files.slice(0, 5).map((file, i) => {
    if (!(file instanceof Blob) || !file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) return '';
    const src = URL.createObjectURL(file); selectedUrls[i] = src;
    return thumbnail(src, file.name || `New photo ${i + 1}`, `previewNewStagePhoto(${i})`);
  }).join('');
  $('#wa-new-photos').innerHTML = html;
}
function showPhoto(src, title) {
  const dialog = $('#stage-photo-viewer');
  $('#stage-photo-title').textContent = title; $('#stage-photo-image').src = src;
  $('#stage-photo-image').alt = title; $('#stage-photo-caption').textContent = title;
  if (!dialog.open) dialog.showModal();
}
export function previewFaultPhoto() { if (workId) showPhoto(`/api/work-orders/${Number(workId)}/photo`, 'Reported fault photo'); }
export function previewStagePhoto(stage, photo, number) { showPhoto(url(stage, photo), `Stage photo ${Number(number)}`); }
export function previewNewStagePhoto(index) { if (selectedUrls[index]) showPhoto(selectedUrls[index], `New photo ${Number(index) + 1}`); }
$('#stage-photo-image').addEventListener?.('error', () => { $('#stage-photo-caption').textContent = 'This photo could not be loaded.'; });
Object.assign(window, { previewStagePhoto, previewNewStagePhoto, previewFaultPhoto });
$('#work-assign').addEventListener?.('close', () => { if (!$('#work-assign').open) resetStageGallery(null); });
