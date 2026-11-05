import { initDb } from './database.js';
import { seedIfEmpty } from './seed.js';

let ready = false;

export async function bootstrap(): Promise<void> {
  if (ready) return;
  await initDb();
  await seedIfEmpty();
  ready = true;
}
