// Shared validation for new and corrected stage photos. Files created during a
// failed request are returned to the caller for cleanup after transaction rollback.
import { MAX_PHOTO_BYTES, savePhoto } from './photos.js';
export const MAX_STAGE_PHOTOS = 5;
export const MAX_STAGE_BODY = MAX_STAGE_PHOTOS * Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 16000;

export function saveStagePhotos(photos, files) {
  if (!Array.isArray(photos) || photos.length > MAX_STAGE_PHOTOS) throw new Error('Choose up to five photos per update');
  for (const photo of photos) {
    if (typeof photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))
      throw new Error('Choose JPEG, PNG or WebP photos');
    const bytes = Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64');
    if (bytes.length > MAX_PHOTO_BYTES) {
      const error = new Error('Each photo must be under 2 MB'); error.status = 413; throw error;
    }
    const saved = savePhoto(bytes);
    if (saved.error) throw new Error(saved.error);
    files.push(saved.name);
  }
}
