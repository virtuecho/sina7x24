export function matchesAllowedHost(hostname, allowedSuffixes) {
  return allowedSuffixes.some(
    suffix => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}
