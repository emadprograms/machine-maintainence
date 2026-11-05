import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/** Resolved backend/dist directory (local dev or Netlify function bundle). */
export function backendDistDir(): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      let dir = path.dirname(fileURLToPath(import.meta.url));
      while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'bootstrap.js'))) return dir;
        dir = path.dirname(dir);
      }
    }
  } catch {
    /* esbuild bundle — import.meta.url unavailable */
  }

  const candidates = [
    path.join(process.cwd(), 'backend', 'dist'),
    path.join('/var/task', 'backend', 'dist'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'bootstrap.js'))) return dir;
  }

  return path.join(process.cwd(), 'backend', 'dist');
}
