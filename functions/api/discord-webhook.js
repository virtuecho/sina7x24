import {
  DEFAULT_ALLOWED_DISCORD_HOST_SUFFIXES,
  DEFAULT_DISCORD_WEBHOOK_TIMEOUT_MS
} from '../../backend/core/config.js';
import { handleDiscordWebhookRequest } from '../../backend/core/discord.js';

export async function onRequestPost(context) {
  return handleDiscordWebhookRequest(context.request, {
    discordWebhookTimeoutMs: DEFAULT_DISCORD_WEBHOOK_TIMEOUT_MS,
    allowedDiscordHostSuffixes: DEFAULT_ALLOWED_DISCORD_HOST_SUFFIXES
  });
}
