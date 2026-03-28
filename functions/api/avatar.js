import {
  DEFAULT_ALLOWED_IMAGE_HOST_SUFFIXES,
  DEFAULT_AVATAR_TIMEOUT_MS
} from '../../backend/core/config.js';
import { handleAvatarRequest } from '../../backend/core/avatar.js';

export async function onRequestGet(context) {
  return handleAvatarRequest(context.request, {
    avatarTimeoutMs: DEFAULT_AVATAR_TIMEOUT_MS,
    allowedImageHostSuffixes: DEFAULT_ALLOWED_IMAGE_HOST_SUFFIXES
  });
}
