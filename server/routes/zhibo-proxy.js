const { createProxyMiddleware } = require('http-proxy-middleware');

function registerZhiboProxyRoute(app, { sinaOrigin, apiTimeoutMs }) {
  app.use(
    '/api/zhibo',
    createProxyMiddleware({
      target: `${sinaOrigin}/api/zhibo`,
      changeOrigin: true,
      xfwd: true,
      logger: console,
      proxyTimeout: apiTimeoutMs,
      timeout: apiTimeoutMs,
      headers: {
        origin: sinaOrigin,
        referer: `${sinaOrigin}/`
      },
      on: {
        proxyReq: (proxyReq, req) => {
          proxyReq.setHeader('accept', 'application/json, text/plain, */*');
          proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Node.js Proxy');
        },
        proxyRes: proxyRes => {
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
}

module.exports = {
  registerZhiboProxyRoute
};
