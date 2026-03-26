const DISCORD_WEBHOOK_TIMEOUT_MS = 15000;
const ALLOWED_DISCORD_HOST_SUFFIXES = ['discord.com', 'discordapp.com'];

function isAllowedDiscordHost(hostname) {
  return ALLOWED_DISCORD_HOST_SUFFIXES.some(
    suffix => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
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

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

export async function onRequestPost(context) {
  let requestBody;

  try {
    requestBody = await context.request.json();
  } catch (_error) {
    return jsonResponse(
      {
        error: 'invalid_json_body',
        message: '请求体不是有效的 JSON'
      },
      400
    );
  }

  const rawWebhookUrl = typeof requestBody?.webhookUrl === 'string'
    ? requestBody.webhookUrl.trim()
    : '';
  const content = typeof requestBody?.content === 'string'
    ? requestBody.content.trim()
    : '';
  const username = typeof requestBody?.username === 'string'
    ? requestBody.username.trim()
    : '';
  const messageId = typeof requestBody?.messageId === 'string'
    ? requestBody.messageId.trim()
    : '';

  if (!rawWebhookUrl) {
    return jsonResponse(
      {
        error: 'missing_discord_webhook_url',
        message: '缺少 Discord Webhook 地址'
      },
      400
    );
  }

  if (!content) {
    return jsonResponse(
      {
        error: 'missing_discord_webhook_content',
        message: '缺少要发送的 Discord 消息内容'
      },
      400
    );
  }

  if (content.length > 2000) {
    return jsonResponse(
      {
        error: 'discord_webhook_content_too_long',
        message: 'Discord 文本消息内容不能超过 2000 个字符'
      },
      400
    );
  }

  if (username.length > 80) {
    return jsonResponse(
      {
        error: 'discord_webhook_username_too_long',
        message: 'Discord Webhook 用户名不能超过 80 个字符'
      },
      400
    );
  }

  let targetUrl;
  const method = messageId ? 'PATCH' : 'POST';
  try {
    targetUrl = messageId
      ? buildDiscordWebhookMessageUrl(rawWebhookUrl, messageId)
      : buildDiscordWebhookExecuteUrl(rawWebhookUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'discord_host_not_allowed' ? 403 : 400;

    return jsonResponse(
      {
        error: message,
        message: 'Discord Webhook 地址不可用'
      },
      status
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DISCORD_WEBHOOK_TIMEOUT_MS);
  const payload = { content };

  if (username && !messageId) {
    payload.username = username;
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const rawResponse = await upstreamResponse.text();
    let responseJson = null;

    if (rawResponse) {
      try {
        responseJson = JSON.parse(rawResponse);
      } catch (_error) {
        responseJson = null;
      }
    }

    if (!upstreamResponse.ok) {
      return jsonResponse(
        {
          error: 'discord_webhook_upstream_error',
          message: responseJson?.message || 'Discord Webhook 请求失败',
          details: responseJson || rawResponse || null
        },
        upstreamResponse.status
      );
    }

    return jsonResponse({
      ok: true,
      message: messageId ? '消息已更新到 Discord' : '消息已发送到 Discord',
      messageId: responseJson?.id || '',
      channelId: responseJson?.channel_id || '',
      timestamp: responseJson?.timestamp || ''
    });
  } catch (error) {
    const isTimeout = error && error.name === 'AbortError';

    return jsonResponse(
      {
        error: isTimeout ? 'discord_webhook_timeout' : 'discord_webhook_proxy_error',
        message: isTimeout ? 'Discord Webhook 请求超时' : 'Discord Webhook 请求失败',
        details: error instanceof Error ? error.message : String(error)
      },
      isTimeout ? 504 : 502
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
