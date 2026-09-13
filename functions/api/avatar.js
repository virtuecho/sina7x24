import { handleAvatarRequest } from '../../backend/core/avatar.js';

export async function onRequestGet(context) {
  return handleAvatarRequest(context.request);
}
