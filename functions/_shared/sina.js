export function buildSinaFeedTargetUrl(requestUrl) {
  const incomingUrl = new URL(requestUrl);
  const targetUrl = new URL('https://zhibo.sina.com.cn/api/zhibo/feed');

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  return targetUrl;
}
