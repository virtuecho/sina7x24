const ALLOWED_IMAGE_HOST_SUFFIXES = ['sinaimg.cn', 'sinaimg.com'];

function isAllowedImageHost(hostname) {
  return ALLOWED_IMAGE_HOST_SUFFIXES.some(
    suffix => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

export function buildAvatarTargetUrl(requestUrl) {
  const incomingUrl = new URL(requestUrl);
  const rawUrl = incomingUrl.searchParams.get('url');

  if (!rawUrl) {
    throw new Error('missing_avatar_url');
  }

  const targetUrl = new URL(rawUrl);

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    throw new Error('invalid_avatar_protocol');
  }

  if (!isAllowedImageHost(targetUrl.hostname)) {
    throw new Error('avatar_host_not_allowed');
  }

  return targetUrl;
}
