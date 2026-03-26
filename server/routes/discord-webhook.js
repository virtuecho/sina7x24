function registerDiscordWebhookRoute(app, {
  discordWebhookTimeoutMs,
  buildDiscordWebhookExecuteUrl,
  buildDiscordWebhookMessageUrl
}) {
  app.post('/api/discord-webhook', async (req, res) => {
    res.setHeader('cache-control', 'no-store');

    const rawWebhookUrl = typeof req.body?.webhookUrl === 'string'
      ? req.body.webhookUrl.trim()
      : '';
    const content = typeof req.body?.content === 'string'
      ? req.body.content.trim()
      : '';
    const username = typeof req.body?.username === 'string'
      ? req.body.username.trim()
      : '';
    const messageId = typeof req.body?.messageId === 'string'
      ? req.body.messageId.trim()
      : '';

    if (!rawWebhookUrl) {
      res.status(400).json({
        error: 'missing_discord_webhook_url',
        message: '缺少 Discord Webhook 地址'
      });
      return;
    }

    if (!content) {
      res.status(400).json({
        error: 'missing_discord_webhook_content',
        message: '缺少要发送的 Discord 消息内容'
      });
      return;
    }

    if (content.length > 2000) {
      res.status(400).json({
        error: 'discord_webhook_content_too_long',
        message: 'Discord 文本消息内容不能超过 2000 个字符'
      });
      return;
    }

    if (username.length > 80) {
      res.status(400).json({
        error: 'discord_webhook_username_too_long',
        message: 'Discord Webhook 用户名不能超过 80 个字符'
      });
      return;
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

      res.status(status).json({
        error: message,
        message: 'Discord Webhook 地址不可用'
      });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), discordWebhookTimeoutMs);
    const payload = { content };

    if (username && !messageId) {
      payload.username = username;
    }

    try {
      const upstreamResponse = await fetch(targetUrl, {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': req.headers['user-agent'] || 'Node.js Proxy'
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
        res.status(upstreamResponse.status).json({
          error: 'discord_webhook_upstream_error',
          message: responseJson?.message || 'Discord Webhook 请求失败',
          details: responseJson || rawResponse || null
        });
        return;
      }

      res.status(200).json({
        ok: true,
        message: messageId ? '消息已更新到 Discord' : '消息已发送到 Discord',
        messageId: responseJson?.id || '',
        channelId: responseJson?.channel_id || '',
        timestamp: responseJson?.timestamp || ''
      });
    } catch (error) {
      const isTimeout = error && error.name === 'AbortError';

      res.status(isTimeout ? 504 : 502).json({
        error: isTimeout ? 'discord_webhook_timeout' : 'discord_webhook_proxy_error',
        message: isTimeout ? 'Discord Webhook 请求超时' : 'Discord Webhook 请求失败',
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

module.exports = {
  registerDiscordWebhookRoute
};
