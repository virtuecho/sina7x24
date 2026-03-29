const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

function getExpressRequestOrigin(req) {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || '127.0.0.1';

  return `${protocol}://${host}`;
}

function serializeExpressRequestBody(req) {
  if (req.body == null || req.method === 'GET' || req.method === 'HEAD') {
    return null;
  }

  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    return req.body;
  }

  return JSON.stringify(req.body);
}

function createRequestHeaders(req, body) {
  const headers = new Headers();

  Object.entries(req.headers).forEach(([headerName, headerValue]) => {
    if (headerValue == null) {
      return;
    }

    if (Array.isArray(headerValue)) {
      headerValue.forEach(value => headers.append(headerName, value));
      return;
    }

    headers.set(headerName, String(headerValue));
  });

  if (body != null) {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    headers.set('content-length', String(Buffer.byteLength(body)));
  } else {
    headers.delete('content-length');
  }

  return headers;
}

export function createWebRequestFromExpress(req) {
  const body = serializeExpressRequestBody(req);
  const requestUrl = new URL(req.originalUrl || req.url, getExpressRequestOrigin(req));

  return new Request(requestUrl, {
    method: req.method,
    headers: createRequestHeaders(req, body),
    body: body == null ? undefined : body
  });
}

export async function sendWebResponseToExpress(res, response) {
  res.status(response.status);

  response.headers.forEach((headerValue, headerName) => {
    const normalizedHeaderName = headerName.toLowerCase();

    if (
      normalizedHeaderName === 'content-length'
      || HOP_BY_HOP_RESPONSE_HEADERS.has(normalizedHeaderName)
    ) {
      return;
    }

    res.setHeader(headerName, headerValue);
  });

  if (!response.body) {
    res.end();
    return;
  }

  const body = Buffer.from(await response.arrayBuffer());
  res.send(body);
}
