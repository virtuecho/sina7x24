import path from 'node:path';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { handleAvatarRequest } from '../backend/core/avatar.js';
import { handleSinaApiProxyRequest } from '../backend/core/sina.js';
import { createWebRequestFromExpress, sendWebResponseToExpress } from './adapters/web-interop.js';
import { ROOT_DIR } from './config.js';

function createApp() {
  const app = express();
  const indexPath = path.join(ROOT_DIR, 'index.html');

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/zhibo', async (req, res) => {
    const request = createWebRequestFromExpress(req);
    const response = await handleSinaApiProxyRequest(request);
    await sendWebResponseToExpress(res, response);
  });

  app.get('/api/avatar', async (req, res) => {
    const request = createWebRequestFromExpress(req);
    const response = await handleAvatarRequest(request);
    await sendWebResponseToExpress(res, response);
  });

  app.get('/', (_req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
  });

  app.get('/legacy', async (_req, res, next) => {
    try {
      const indexHtml = await readFile(indexPath, 'utf8');
      const legacyHtml = indexHtml.replace('<body>', '<body class="minimal-mode">');
      res.type('html').send(legacyHtml);
    } catch (error) {
      next(error);
    }
  });

  app.use(
    express.static(ROOT_DIR, {
      extensions: ['html']
    })
  );

  return app;
}

export {
  createApp
};
