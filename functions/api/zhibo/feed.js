import { DEFAULT_API_TIMEOUT_MS, DEFAULT_SINA_ORIGIN } from '../../../backend/core/config.js';
import { handleSinaApiProxyRequest } from '../../../backend/core/sina.js';

export async function onRequestGet(context) {
  return handleSinaApiProxyRequest(context.request, {
    sinaOrigin: DEFAULT_SINA_ORIGIN,
    apiTimeoutMs: DEFAULT_API_TIMEOUT_MS
  });
}
