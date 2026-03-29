import {
  DEFAULT_ALLOWED_IMAGE_HOST_SUFFIXES,
  DEFAULT_AVATAR_TIMEOUT_MS
} from './config.js';
import {
  fetchWithTimeout,
  isAbortError,
  jsonResponse,
  readRequestUserAgent
} from './http.js';
import { matchesAllowedHost } from './hosts.js';

export function isAllowedImageHost(
  hostname,
  { allowedImageHostSuffixes = DEFAULT_ALLOWED_IMAGE_HOST_SUFFIXES } = {}
) {
  return matchesAllowedHost(hostname, allowedImageHostSuffixes);
}

export function buildAvatarTargetUrl(
  requestUrl,
  { allowedImageHostSuffixes = DEFAULT_ALLOWED_IMAGE_HOST_SUFFIXES } = {}
) {
  const incomingUrl = new URL(requestUrl);
  const rawUrl = incomingUrl.searchParams.get('url');

  if (!rawUrl) {
    throw new Error('missing_avatar_url');
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch (_error) {
    throw new Error('invalid_avatar_url');
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    throw new Error('invalid_avatar_protocol');
  }

  if (!isAllowedImageHost(targetUrl.hostname, { allowedImageHostSuffixes })) {
    throw new Error('avatar_host_not_allowed');
  }

  return targetUrl;
}

function getAvatarValidationStatus(code) {
  return code === 'avatar_host_not_allowed' ? 403 : 400;
}

function getAvatarValidationMessage(code) {
  switch (code) {
    case 'missing_avatar_url':
      return '缺少头像地址';
    case 'invalid_avatar_url':
      return '头像地址格式无效';
    case 'invalid_avatar_protocol':
      return '头像地址协议不受支持';
    case 'avatar_host_not_allowed':
      return '头像来源域名不在允许范围内';
    default:
      return '头像地址不可用';
  }
}

export async function handleAvatarRequest(
  request,
  {
    avatarTimeoutMs = DEFAULT_AVATAR_TIMEOUT_MS,
    allowedImageHostSuffixes = DEFAULT_ALLOWED_IMAGE_HOST_SUFFIXES
  } = {}
) {
  let targetUrl;

  try {
    targetUrl = buildAvatarTargetUrl(request.url, { allowedImageHostSuffixes });
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);

    return jsonResponse(
      {
        error: code,
        message: getAvatarValidationMessage(code)
      },
      getAvatarValidationStatus(code)
    );
  }

  try {
    const upstreamResponse = await fetchWithTimeout(
      targetUrl,
      {
        method: 'GET',
        headers: {
          accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'user-agent': readRequestUserAgent(request, 'Node.js Proxy'),
          referer: 'https://finance.sina.com.cn/',
          origin: 'https://finance.sina.com.cn'
        },
        redirect: 'follow'
      },
      avatarTimeoutMs
    );

    if (!upstreamResponse.ok) {
      return jsonResponse(
        {
          error: 'avatar_upstream_error',
          message: '头像上游请求失败'
        },
        upstreamResponse.status
      );
    }

    const responseHeaders = new Headers(upstreamResponse.headers);
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
    return jsonResponse(
      {
        error: isAbortError(error) ? 'avatar_proxy_timeout' : 'avatar_proxy_error',
        message: isAbortError(error) ? '头像请求超时' : '头像请求失败',
        details: error instanceof Error ? error.message : String(error)
      },
      isAbortError(error) ? 504 : 502
    );
  }
}
