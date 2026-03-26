import { jsonResponse } from '../../_shared/http.js';
import { buildSinaFeedTargetUrl } from '../../_shared/sina.js';

const API_TIMEOUT_MS = 10000;

export async function onRequestGet(context) {
  const targetUrl = buildSinaFeedTargetUrl(context.request.url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain, */*',
        origin: 'https://zhibo.sina.com.cn',
        referer: 'https://zhibo.sina.com.cn/'
      },
      signal: controller.signal
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set('cache-control', 'no-store');
    responseHeaders.set('access-control-allow-origin', '*');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    const isTimeout = error && error.name === 'AbortError';

    return jsonResponse(
      {
        error: isTimeout ? 'proxy_timeout' : 'proxy_error',
        message: isTimeout ? '请求新浪接口超时' : '请求新浪接口失败',
        details: error instanceof Error ? error.message : String(error)
      },
      isTimeout ? 504 : 502
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
