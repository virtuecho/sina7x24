import { handleSinaApiProxyRequest } from '../../../backend/core/sina.js';

export async function onRequestGet(context) {
  return handleSinaApiProxyRequest(context.request);
}
