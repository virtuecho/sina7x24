import { buildAvatarTargetUrl } from '../_shared/avatar.js';
import { jsonResponse } from '../_shared/http.js';

const AVATAR_TIMEOUT_MS = 10000;

export async function onRequestGet(context) {
  let targetUrl;

  try {
    targetUrl = buildAvatarTargetUrl(context.request.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'avatar_host_not_allowed' ? 403 : 400;

    return jsonResponse(
      {
        error: message,
        message: '头像地址不可用'
      },
      status,
      { 'access-control-allow-origin': '*' }
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
      return jsonResponse(
        {
          error: 'avatar_upstream_error',
          message: '头像上游请求失败'
        },
        upstreamResponse.status,
        { 'access-control-allow-origin': '*' }
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

    return jsonResponse(
      {
        error: isTimeout ? 'avatar_proxy_timeout' : 'avatar_proxy_error',
        message: isTimeout ? '头像请求超时' : '头像请求失败',
        details: error instanceof Error ? error.message : String(error)
      },
      isTimeout ? 504 : 502,
      { 'access-control-allow-origin': '*' }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
