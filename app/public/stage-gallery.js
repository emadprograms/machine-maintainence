// Images and videos share the accessible in-app preview.
let workId = null, selectedUrls = [], selectedVideos = [];
const url = (stage, photo) => `/api/work-orders/${Number(workId)}/updates/${Number(stage)}/photos/${Number(photo)}`;
export function resetStageGallery(id) {
  workId = id;
  selectedUrls.forEach((u) => URL.revokeObjectURL(u)); selectedUrls = []; selectedVideos = [];
  $('#wa-new-photos').innerHTML = '';
}
function thumbnail(src, caption, action, video = false) {
  return `<button type="button" class="stage-thumbnail" onclick="${action}" aria-label="Preview ${esc(caption)}" title="Preview ${esc(caption)}">${video ? `<video src="${src}" preload="metadata" muted playsinline></video>` : `<img src="${src}" alt="" loading="lazy">`}<span>${esc(caption)}</span></button>`;
}
export function historyPhotos(stage) {
  const items = (stage.photos || []).map((photo, i) => {
    const video = (stage.photo_videos || []).includes(photo);
    return thumbnail(url(stage.id, photo), `${video ? 'Video' : 'Photo'} ${i + 1}`, `previewStagePhoto(${Number(stage.id)}, ${Number(photo)}, ${i + 1}, ${video})`, video);
  });
  return items.length ? `<div class="stage-photo-grid">${items.join('')}</div>` : '';
}
export function existingPhotos(stage) {
  return (stage.photos || []).map((photo, i) => {
    const video = (stage.photo_videos || []).includes(photo), kind = video ? 'video' : 'photo';
    return `<div class="stage-photo-card">${thumbnail(url(stage.id, photo), `${kind} ${i + 1}`, `previewStagePhoto(${Number(stage.id)}, ${Number(photo)}, ${i + 1}, ${video})`, video)}<label><input type="checkbox" value="${Number(photo)}" checked onchange="stagePhotoSelectionChanged()" /> Keep ${kind} ${i + 1}</label></div>`;
  }).join('');
}
export function updateNewPhotos(files) {
  selectedUrls.forEach((u) => URL.revokeObjectURL(u)); selectedUrls = []; selectedVideos = [];
  const html = files.slice(0, 5).map((file, i) => {
    if (!(file instanceof Blob) || !(file.type.startsWith('image/') || file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name || ''))) return '';
    const src = URL.createObjectURL(file), video = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name);
    selectedUrls[i] = src; selectedVideos[i] = video;
    return thumbnail(src, file.name || `New file ${i + 1}`, `previewNewStagePhoto(${i})`, video);
  }).join('');
  $('#wa-new-photos').innerHTML = html;
}
function showPhoto(src, title, video = false) {
  const dialog = $('#stage-photo-viewer'), img = $('#stage-photo-image'), player = $('#stage-photo-video');
  $('#stage-photo-title').textContent = title;
  img.hidden = video; player.hidden = !video;
  if (video) { img.removeAttribute?.('src'); player.src = src; }
  else { player.pause?.(); player.removeAttribute?.('src'); img.src = src; img.alt = title; }
  $('#stage-photo-caption').textContent = title;
  if (!dialog.open) dialog.showModal();
}
export function previewFaultPhoto(video = false) { if (workId) showPhoto(`/api/work-orders/${Number(workId)}/photo`, 'Reported fault media', video); }
export function previewStagePhoto(stage, photo, number, video = false) { showPhoto(url(stage, photo), `Stage ${video ? 'video' : 'photo'} ${Number(number)}`, video); }
export function previewNewStagePhoto(index) { if (selectedUrls[index]) showPhoto(selectedUrls[index], `New file ${Number(index) + 1}`, selectedVideos[index]); }
$('#stage-photo-image').addEventListener?.('error', () => { $('#stage-photo-caption').textContent = 'This photo could not be loaded.'; });
$('#stage-photo-viewer').addEventListener?.('close', () => { const video = $('#stage-photo-video'); video.pause(); video.removeAttribute('src'); });
Object.assign(window, { previewStagePhoto, previewNewStagePhoto, previewFaultPhoto });
$('#work-assign').addEventListener?.('close', () => { if (!$('#work-assign').open) resetStageGallery(null); });
