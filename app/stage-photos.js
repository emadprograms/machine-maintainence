// Shared validation for new and corrected stage photos. Files created during a
// failed request are returned to the caller for cleanup after transaction rollback.
import { savePhoto } from './photos.js';
export const MAX_STAGE_PHOTOS = 5;
// Legacy inline JSON is bounded; new media uploads are streamed separately.
export const MAX_STAGE_BODY = 32 * 1024 * 1024;

export function saveStagePhotos(photos, files) {
  if (!Array.isArray(photos) || photos.length > MAX_STAGE_PHOTOS) throw new Error('Choose up to five photos per update');
  for (const photo of photos) {
    if (typeof photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))
      throw new Error('Choose JPEG, PNG or WebP photos');
    const bytes = Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64');
    const saved = savePhoto(bytes);
    if (saved.error) throw new Error(saved.error);
    files.push(saved.name);
  }
}
