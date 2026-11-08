// Gallery behavior without a DOM library or an internet connection.
import assert from 'node:assert/strict';
const nodes = new Map();
globalThis.$ = (key) => {
  if (!nodes.has(key)) nodes.set(key, { innerHTML: '', textContent: '', open: false, listeners: {},
    addEventListener(event, handler) { this.listeners[event] = handler; }, showModal() { this.open = true; }, close() { this.open = false; } });
  return nodes.get(key);
};
globalThis.esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
globalThis.window = {};
const revoked = [], created = [], realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
URL.createObjectURL = (file) => { const u = `blob:example/${created.length}`; created.push(file); return u; };
URL.revokeObjectURL = (u) => revoked.push(u);
try {
  const gallery = await import('../public/stage-gallery.js');
  gallery.resetStageGallery(42);
  const stage = { id: 5, photos: [17, 18] };
  const history = gallery.historyPhotos(stage), existing = gallery.existingPhotos(stage);
  assert.match(history, /\/api\/work-orders\/42\/updates\/5\/photos\/17/);
  assert.match(history, /aria-label="Preview Photo 1"/); assert.match(existing, /checked onchange="stagePhotoSelectionChanged/);
  window.previewStagePhoto(5, 17, 1);
  assert.equal($('#stage-photo-viewer').open, true);
  assert.equal($('#stage-photo-image').src, '/api/work-orders/42/updates/5/photos/17');
  assert.equal($('#stage-photo-image').alt, 'Stage photo 1');
  $('#stage-photo-image').listeners.error(); assert.match($('#stage-photo-caption').textContent, /could not be loaded/i);
  $('#stage-photo-viewer').close();
  const file = new Blob(['picture'], { type: 'image/png' }); file.name = 'test "<photo>.png';
  gallery.updateNewPhotos([file]);
  assert.match($('#wa-new-photos').innerHTML, /test &quot;&lt;photo&gt;.png/);
  window.previewNewStagePhoto(0); assert.equal($('#stage-photo-image').src, 'blob:example/0');
  assert.equal($('#stage-photo-viewer').open, true);
  gallery.updateNewPhotos([file, file, file, file, file, file]);
  assert.equal(created.length, 6); assert.deepEqual(revoked, ['blob:example/0']);
  gallery.resetStageGallery(99);
  assert.equal(revoked.length, 6); assert.equal($('#wa-new-photos').innerHTML, '');
  assert.match(gallery.historyPhotos(stage), /\/work-orders\/99\/updates\/5\/photos\/17/);
  const count = created.length;
  gallery.updateNewPhotos([new Blob(['not-image'], { type: 'text/plain' })]);
  assert.equal(created.length, count);
  console.log('Stage gallery interactions passed');
} finally { URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; }
