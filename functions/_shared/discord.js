const ALLOWED_DISCORD_HOST_SUFFIXES = ['discord.com', 'discordapp.com'];

function isAllowedDiscordHost(hostname) {
  return ALLOWED_DISCORD_HOST_SUFFIXES.some(
    suffix => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

export function buildDiscordWebhookExecuteUrl(rawUrl) {
  const targetUrl = new URL(rawUrl);

  if (targetUrl.protocol !== 'https:') {
    throw new Error('invalid_discord_webhook_protocol');
  }

  if (!isAllowedDiscordHost(targetUrl.hostname)) {
    throw new Error('discord_host_not_allowed');
  }

  if (!/^\/api\/webhooks\/\d+\/[^/]+\/?$/.test(targetUrl.pathname)) {
    throw new Error('invalid_discord_webhook_path');
  }

  targetUrl.searchParams.set('wait', 'true');
  return targetUrl;
}

export function buildDiscordWebhookMessageUrl(rawUrl, messageId) {
  const targetUrl = new URL(rawUrl);

  if (targetUrl.protocol !== 'https:') {
    throw new Error('invalid_discord_webhook_protocol');
  }

  if (!isAllowedDiscordHost(targetUrl.hostname)) {
    throw new Error('discord_host_not_allowed');
  }

  if (!/^\d+$/.test(messageId)) {
    throw new Error('invalid_discord_message_id');
  }

  const basePathMatch = targetUrl.pathname.match(/^(\/api\/webhooks\/\d+\/[^/]+)\/?$/);
  if (!basePathMatch) {
    throw new Error('invalid_discord_webhook_path');
  }

  targetUrl.pathname = `${basePathMatch[1]}/messages/${messageId}`;
  targetUrl.search = '';
  return targetUrl;
}
