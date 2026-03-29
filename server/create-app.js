import path from 'node:path';
import express from 'express';
import {
  ALLOWED_IMAGE_HOST_SUFFIXES,
  API_TIMEOUT_MS,
  AVATAR_TIMEOUT_MS,
  ROOT_DIR,
  SINA_ORIGIN
} from './config.js';
import { registerHealthRoute } from './routes/health.js';
import { registerZhiboProxyRoute } from './routes/zhibo-proxy.js';
import { registerAvatarRoute } from './routes/avatar.js';

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  registerHealthRoute(app);
  registerZhiboProxyRoute(app, {
    sinaOrigin: SINA_ORIGIN,
    apiTimeoutMs: API_TIMEOUT_MS
  });
  registerAvatarRoute(app, {
    avatarTimeoutMs: AVATAR_TIMEOUT_MS,
    allowedImageHostSuffixes: ALLOWED_IMAGE_HOST_SUFFIXES
  });

  app.use(
    express.static(ROOT_DIR, {
      extensions: ['html']
    })
  );

  app.get('/', (_req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
  });

  return app;
}

export {
  createApp
};
