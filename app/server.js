// The server: it starts, it seeds the first account, it decides which route a
// request belongs to, and it serves the one HTML page. Nothing else.
//
// The handlers live in routes/, one file per screen group, because this file was
// 814 lines and the project's own rule is that anything past ~600 is a signal to
// split. Reading a route now means opening the file named after the screen.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, run, close, DB_PATH, rememberFirstPassword } from './db.js';
import { purgeExpired } from './sessions.js';
import { hashPassword, randomPassword } from './auth.js';

import authRoutes from './routes/auth.js';
import recordRoutes from './routes/record.js';
import equipmentRoutes from './routes/equipment.js';
import workOrderRoutes from './routes/work-orders.js';
import partsRoutes from './routes/parts.js';
import pmRoutes from './routes/pm.js';
import dashboardRoutes from './routes/dashboard.js';
import adminRoutes from './routes/admin.js';
import reportRoutes from './routes/report.js';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';           // reachable from other PCs on the workshop network

// ------------------------------------------------------------- first run
// Instead of seeding demo accounts with a known password (what the reviewed
// repo did), create one admin whose password we print once — and also write it
// next to the database, because a password that exists only in a console window
// that gets closed is a password that cannot be recovered.
if (!get('SELECT id FROM users LIMIT 1')) {
  const password = process.env.MM_ADMIN_PASSWORD || randomPassword();
  run('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)',
    'Admin', 'admin@local', hashPassword(password), 'admin');
  const note = rememberFirstPassword(password);
  console.log('\n  Created the first account:');
  console.log('    email:    admin@local');
  console.log(`    password: ${password}`);
  console.log(`  It is also written to ${note}`);
  console.log('  Sign in, open Users, and change it — that deletes the file.\n');
}

// ------------------------------------------------------------------ API
// Every route in the application, assembled from the files beside this one.
const api = {
  ...authRoutes,
  ...recordRoutes,
  ...equipmentRoutes,
  ...workOrderRoutes,
  ...partsRoutes,
  ...pmRoutes,
  ...dashboardRoutes,
  ...adminRoutes,
  ...reportRoutes,
};

// -------------------------------------------------------------- routing
// Turn "/api/equipment/:id" into a regex so we never hand-parse paths.
const routes = Object.entries(api).map(([key, handler]) => {
  const [method, pattern] = key.split(' ');
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => {
    keys.push(k);
    return '([^/]+)';
  }) + '$');
  return { method, regex, keys, handler };
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  req.query = Object.fromEntries(url.searchParams);

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.pathname.match(r.regex);
    if (!m) continue;
    req.params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    return r.handler(req, res);
  }

  // Everything else is a static file, with a fallback to index.html.
  const file = join(root, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (existsSync(file) && file.startsWith(join(root, 'public'))) {
    const type = file.endsWith('.js') ? 'text/javascript'
      : file.endsWith('.css') ? 'text/css' : 'text/html';
    res.writeHead(200, { 'content-type': `${type}; charset=utf-8` });
    return res.end(readFileSync(file));
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
});

// Sessions left over from before a restart are still valid; expired ones are
// deleted on the way in so the table cannot grow without limit.
purgeExpired();

// Ctrl+C closes the database properly, which merges the side file into
// maintain.db. Windows cannot trap SIGTERM, which is why every write also
// checkpoints on its own — shutting down cleanly is a bonus, not the safety net.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\n  Closing the database.');
    try { close(); } catch { /* already closed */ }
    process.exit(0);
  });
}

server.listen(PORT, HOST, () => {
  console.log(`Machine maintenance running at http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log('Stop it with Ctrl+C in this window.');
});
