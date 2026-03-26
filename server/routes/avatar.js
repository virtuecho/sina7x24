function registerAvatarRoute(app, { avatarTimeoutMs, isAllowedImageHost }) {
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
    } catch (_error) {
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
    const timeoutId = setTimeout(() => controller.abort(), avatarTimeoutMs);

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
}

module.exports = {
  registerAvatarRoute
};
