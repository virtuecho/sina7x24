const AVATAR_TIMEOUT_MS = 10000;
const ALLOWED_IMAGE_HOST_SUFFIXES = ['sinaimg.cn', 'sinaimg.com'];

function isAllowedImageHost(hostname) {
  return ALLOWED_IMAGE_HOST_SUFFIXES.some(
    suffix => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

function buildTargetUrl(requestUrl) {
  const incomingUrl = new URL(requestUrl);
  const rawUrl = incomingUrl.searchParams.get('url');

  if (!rawUrl) {
    throw new Error('missing_avatar_url');
  }

  const targetUrl = new URL(rawUrl);

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    throw new Error('invalid_avatar_protocol');
  }

  if (!isAllowedImageHost(targetUrl.hostname)) {
    throw new Error('avatar_host_not_allowed');
  }

  return targetUrl;
}

export async function onRequestGet(context) {
  let targetUrl;

  try {
    targetUrl = buildTargetUrl(context.request.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'avatar_host_not_allowed' ? 403 : 400;

    return Response.json(
      {
        error: message,
        message: '头像地址不可用'
      },
      {
        status,
        headers: {
          'cache-control': 'no-store'
        }
      }
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AVATAR_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        origin: 'https://finance.sina.com.cn',
        referer: 'https://finance.sina.com.cn/'
      },
      redirect: 'follow',
      signal: controller.signal
    });

    if (!upstreamResponse.ok) {
      return Response.json(
        {
          error: 'avatar_upstream_error',
          message: '头像上游请求失败'
        },
        {
          status: upstreamResponse.status,
          headers: {
            'cache-control': 'no-store'
          }
        }
      );
    }

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set('access-control-allow-origin', '*');
    responseHeaders.set(
      'cache-control',
      upstreamResponse.headers.get('cache-control') || 'public, max-age=3600'
    );
    responseHeaders.set('cross-origin-resource-policy', 'same-origin');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    const isTimeout = error && error.name === 'AbortError';

    return Response.json(
      {
        error: isTimeout ? 'avatar_proxy_timeout' : 'avatar_proxy_error',
        message: isTimeout ? '头像请求超时' : '头像请求失败',
        details: error instanceof Error ? error.message : String(error)
      },
      {
        status: isTimeout ? 504 : 502,
        headers: {
          'cache-control': 'no-store'
        }
      }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
