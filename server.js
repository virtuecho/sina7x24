const path = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const SINA_ORIGIN = 'https://zhibo.sina.com.cn';
const API_TIMEOUT_MS = 10000;
const AVATAR_TIMEOUT_MS = 10000;
const DISCORD_WEBHOOK_TIMEOUT_MS = 15000;
const ALLOWED_IMAGE_HOST_SUFFIXES = ['sinaimg.cn', 'sinaimg.com'];
const ALLOWED_DISCORD_HOST_SUFFIXES = ['discord.com', 'discordapp.com'];

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

function isAllowedImageHost(hostname) {
  return ALLOWED_IMAGE_HOST_SUFFIXES.some(
    suffix => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

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

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.use(
  '/api/zhibo',
  createProxyMiddleware({
    target: `${SINA_ORIGIN}/api/zhibo`,
    changeOrigin: true,
    xfwd: true,
    logger: console,
    proxyTimeout: API_TIMEOUT_MS,
    timeout: API_TIMEOUT_MS,
    headers: {
      origin: SINA_ORIGIN,
      referer: `${SINA_ORIGIN}/`
    },
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader('accept', 'application/json, text/plain, */*');
        proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Node.js Proxy');
      },
      proxyRes: (proxyRes) => {
        proxyRes.headers['cache-control'] = 'no-store';
      },
      error: (err, req, res) => {
        console.error(`[proxy] ${req.method} ${req.originalUrl}: ${err.message}`);

        if (res.headersSent) {
          return;
        }

        res.status(502).json({
          error: 'proxy_error',
          message: '无法连接新浪直播接口',
          details: err.message
        });
      }
    }
  })
);

app.get('/api/avatar', async (req, res) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';

  if (!rawUrl) {
    res.status(400).json({
      error: 'invalid_avatar_url',
      message: '缺少头像地址'
    });
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch (error) {
    res.status(400).json({
      error: 'invalid_avatar_url',
      message: '头像地址格式无效'
    });
    return;
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    res.status(400).json({
      error: 'invalid_avatar_protocol',
      message: '头像地址协议不受支持'
    });
    return;
  }

  if (!isAllowedImageHost(targetUrl.hostname)) {
    res.status(403).json({
      error: 'avatar_host_not_allowed',
      message: '头像来源域名不在允许范围内'
    });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AVATAR_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': req.headers['user-agent'] || 'Node.js Proxy',
        referer: 'https://finance.sina.com.cn/',
        origin: 'https://finance.sina.com.cn'
      },
      redirect: 'follow',
      signal: controller.signal
    });

    if (!upstreamResponse.ok) {
      res.status(upstreamResponse.status).json({
        error: 'avatar_upstream_error',
        message: '头像上游请求失败'
      });
      return;
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'image/jpeg';
    const cacheControl = upstreamResponse.headers.get('cache-control') || 'public, max-age=3600';
    const body = Buffer.from(await upstreamResponse.arrayBuffer());

    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', cacheControl);
    res.setHeader('cross-origin-resource-policy', 'same-origin');
    res.status(200).send(body);
  } catch (error) {
    const isTimeout = error && error.name === 'AbortError';
    res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'avatar_proxy_timeout' : 'avatar_proxy_error',
      message: isTimeout ? '头像请求超时' : '头像请求失败',
      details: error instanceof Error ? error.message : String(error)
    });
  } finally {
    clearTimeout(timeoutId);
  }
});

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

app.use(
  express.static(ROOT_DIR, {
    extensions: ['html']
  })
);

app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sina 7x24 viewer is running at http://127.0.0.1:${PORT}`);
});
