import path from 'node:path';
import express from 'express';
import { handleAvatarRequest } from '../backend/core/avatar.js';
import { handleSinaApiProxyRequest } from '../backend/core/sina.js';
import { createWebRequestFromExpress, sendWebResponseToExpress } from './adapters/web-interop.js';
import { ROOT_DIR } from './config.js';

function createApp() {
  const app = express();

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

  app.get(['/', '/legacy'], (_req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
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
