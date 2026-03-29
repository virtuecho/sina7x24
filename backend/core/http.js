export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

export function isAbortError(error) {
  return Boolean(error && error.name === 'AbortError');
}

export function readRequestUserAgent(request, fallback = 'Node.js Proxy') {
  return request.headers.get('user-agent') || fallback;
}

export async function fetchWithTimeout(input, init = {}, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function cloneResponseWithHeaders(upstreamResponse, extraHeaders = {}) {
  const responseHeaders = new Headers(upstreamResponse.headers);

  Object.entries(extraHeaders).forEach(([headerName, headerValue]) => {
    responseHeaders.set(headerName, headerValue);
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}
