const SINA_API_URL = 'https://zhibo.sina.com.cn/api/zhibo/feed';
const API_TIMEOUT_MS = 10000;

function buildTargetUrl(requestUrl) {
  const incomingUrl = new URL(requestUrl);
  const targetUrl = new URL(SINA_API_URL);

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  return targetUrl;
}

export async function onRequestGet(context) {
  const targetUrl = buildTargetUrl(context.request.url);
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

    return Response.json(
      {
        error: isTimeout ? 'proxy_timeout' : 'proxy_error',
        message: isTimeout ? '请求新浪接口超时' : '请求新浪接口失败',
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
