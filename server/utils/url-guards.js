function isAllowedHost(hostname, allowedSuffixes) {
  return allowedSuffixes.some(
    suffix => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

function createUrlHelpers({ allowedImageHosts, allowedDiscordHosts }) {
  function isAllowedImageHost(hostname) {
    return isAllowedHost(hostname, allowedImageHosts);
  }

  function isAllowedDiscordHost(hostname) {
    return isAllowedHost(hostname, allowedDiscordHosts);
  }

  function buildDiscordWebhookExecuteUrl(rawUrl) {
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

  function buildDiscordWebhookMessageUrl(rawUrl, messageId) {
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

  return {
    isAllowedImageHost,
    isAllowedDiscordHost,
    buildDiscordWebhookExecuteUrl,
    buildDiscordWebhookMessageUrl
  };
}

module.exports = {
  createUrlHelpers
};
