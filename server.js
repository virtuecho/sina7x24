const path = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const SINA_ORIGIN = 'https://zhibo.sina.com.cn';
const API_TIMEOUT_MS = 10000;
const AVATAR_TIMEOUT_MS = 10000;
const ALLOWED_IMAGE_HOST_SUFFIXES = ['sinaimg.cn', 'sinaimg.com'];

app.disable('x-powered-by');

function isAllowedImageHost(hostname) {
  return ALLOWED_IMAGE_HOST_SUFFIXES.some(
    suffix => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
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
