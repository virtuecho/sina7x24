import { DEFAULT_API_TIMEOUT_MS, DEFAULT_SINA_ORIGIN } from './config.js';
import {
  cloneResponseWithHeaders,
  fetchWithTimeout,
  isAbortError,
  jsonResponse,
  readRequestUserAgent
} from './http.js';

const REQUEST_API_BASE_PATH = '/api/zhibo';
const UPSTREAM_API_BASE_PATH = '/api/zhibo';

export function buildSinaApiTargetUrl(
  requestUrl,
  {
    requestApiBasePath = REQUEST_API_BASE_PATH,
    upstreamApiBasePath = UPSTREAM_API_BASE_PATH,
    sinaOrigin = DEFAULT_SINA_ORIGIN
  } = {}
) {
  const incomingUrl = new URL(requestUrl);
  const relativePath = incomingUrl.pathname.startsWith(requestApiBasePath)
    ? incomingUrl.pathname.slice(requestApiBasePath.length)
    : incomingUrl.pathname;
  const normalizedRelativePath = !relativePath
    ? ''
    : relativePath.startsWith('/')
      ? relativePath
      : `/${relativePath}`;
  const targetUrl = new URL(`${upstreamApiBasePath}${normalizedRelativePath}`, sinaOrigin);

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  return targetUrl;
}

export async function handleSinaApiProxyRequest(
  request,
  {
    sinaOrigin = DEFAULT_SINA_ORIGIN,
    apiTimeoutMs = DEFAULT_API_TIMEOUT_MS,
    requestApiBasePath = REQUEST_API_BASE_PATH,
    upstreamApiBasePath = UPSTREAM_API_BASE_PATH
  } = {}
) {
  const targetUrl = buildSinaApiTargetUrl(request.url, {
    requestApiBasePath,
    upstreamApiBasePath,
    sinaOrigin
  });
  const method = request.method === 'HEAD' ? 'HEAD' : 'GET';

  try {
    const upstreamResponse = await fetchWithTimeout(
      targetUrl,
      {
        method,
        headers: {
          accept: 'application/json, text/plain, */*',
          origin: sinaOrigin,
          referer: `${sinaOrigin}/`,
          'user-agent': readRequestUserAgent(request, 'Node.js Proxy')
        }
      },
      apiTimeoutMs
    );

    return cloneResponseWithHeaders(upstreamResponse, {
      'cache-control': 'no-store'
    });
  } catch (error) {
    return jsonResponse(
      {
        error: isAbortError(error) ? 'proxy_timeout' : 'proxy_error',
        message: isAbortError(error) ? '请求新浪接口超时' : '请求新浪接口失败',
        details: error instanceof Error ? error.message : String(error)
      },
      isAbortError(error) ? 504 : 502
    );
  }
}
