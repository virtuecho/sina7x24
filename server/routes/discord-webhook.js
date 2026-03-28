import { handleDiscordWebhookRequest } from '../../backend/core/discord.js';
import {
  createWebRequestFromExpress,
  sendWebResponseToExpress
} from '../adapters/web-interop.js';

function registerDiscordWebhookRoute(app, {
  discordWebhookTimeoutMs,
  allowedDiscordHostSuffixes
}) {
  app.post('/api/discord-webhook', async (req, res) => {
    const request = createWebRequestFromExpress(req);
    const response = await handleDiscordWebhookRequest(request, {
      discordWebhookTimeoutMs,
      allowedDiscordHostSuffixes
    });

    await sendWebResponseToExpress(res, response);
  });
}

export {
  registerDiscordWebhookRoute
};
