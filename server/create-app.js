const path = require('path');
const express = require('express');
const config = require('./config');
const { createUrlHelpers } = require('./utils/url-guards');
const { registerHealthRoute } = require('./routes/health');
const { registerZhiboProxyRoute } = require('./routes/zhibo-proxy');
const { registerAvatarRoute } = require('./routes/avatar');
const { registerDiscordWebhookRoute } = require('./routes/discord-webhook');

function createApp() {
  const app = express();
  const urlHelpers = createUrlHelpers({
    allowedImageHosts: config.ALLOWED_IMAGE_HOST_SUFFIXES,
    allowedDiscordHosts: config.ALLOWED_DISCORD_HOST_SUFFIXES
  });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  registerHealthRoute(app);
  registerZhiboProxyRoute(app, {
    sinaOrigin: config.SINA_ORIGIN,
    apiTimeoutMs: config.API_TIMEOUT_MS
  });
  registerAvatarRoute(app, {
    avatarTimeoutMs: config.AVATAR_TIMEOUT_MS,
    isAllowedImageHost: urlHelpers.isAllowedImageHost
  });
  registerDiscordWebhookRoute(app, {
    discordWebhookTimeoutMs: config.DISCORD_WEBHOOK_TIMEOUT_MS,
    buildDiscordWebhookExecuteUrl: urlHelpers.buildDiscordWebhookExecuteUrl,
    buildDiscordWebhookMessageUrl: urlHelpers.buildDiscordWebhookMessageUrl
  });

  app.use(
    express.static(config.ROOT_DIR, {
      extensions: ['html']
    })
  );

  app.get('/', (_req, res) => {
    res.sendFile(path.join(config.ROOT_DIR, 'index.html'));
  });

  return app;
}

module.exports = {
  createApp
};
