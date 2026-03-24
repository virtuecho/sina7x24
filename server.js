const path = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const SINA_ORIGIN = 'https://zhibo.sina.com.cn';
const API_TIMEOUT_MS = 10000;

app.disable('x-powered-by');

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
