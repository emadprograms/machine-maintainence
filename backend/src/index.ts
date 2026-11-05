import express from 'express';
import path from 'path';
import fs from 'fs';
import { bootstrap } from './bootstrap.js';
import { createApp } from './app.js';
import { backendDistDir } from './lib/paths.js';

const distDir = backendDistDir();
const PORT = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === 'production';

async function start() {
  await bootstrap();
  const app = createApp();

  const staticCandidates = [
    path.join(distDir, '../../frontend/dist'),
    path.join(distDir, '../../../frontend/dist'),
  ];
  const staticDir = staticCandidates.find(p => fs.existsSync(path.join(p, 'index.html')));

  if (staticDir) {
    app.use(express.static(staticDir, { index: false }));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const mode = isProd ? 'production' : 'development';
    console.log(`MaintainX Pro (${mode}) → http://0.0.0.0:${PORT}`);
    if (staticDir) console.log(`Serving frontend from ${staticDir}`);
  });
}

start().catch(console.error);
