export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      ...extraHeaders
    }
  });
}
