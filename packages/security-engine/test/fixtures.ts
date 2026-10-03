import type { HttpExchange, ReconResult } from '../src/types';

export function exchange(
  url: string,
  status: number,
  headers: Record<string, string | string[]> = {},
  body = '',
  method = 'GET',
): HttpExchange {
  const map: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(headers)) map[k.toLowerCase()] = Array.isArray(v) ? v : [v];
  return {
    request: { method, url, headers: { 'user-agent': 'test' } },
    response: { status, headers: map, bodySnippet: body, bodyTruncated: false },
    durationMs: 1,
  };
}

/** A recon result for a well-configured HTTPS site. Tests override parts. */
export function hardenedRecon(overrides: Partial<ReconResult> = {}): ReconResult {
  const url = 'https://app.example.com/';
  return {
    baseUrl: url,
    baseline: exchange(url, 200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff',
      'strict-transport-security': 'max-age=31536000',
      'referrer-policy': 'no-referrer',
      'ratelimit-policy': '100;w=60',
      server: 'nginx',
      'set-cookie': 'sid=abc; Path=/; HttpOnly; Secure; SameSite=Lax',
    }),
    redirects: [],
    options: exchange(url, 204, { allow: 'GET, HEAD, OPTIONS' }, '', 'OPTIONS'),
    notFound: exchange('https://app.example.com/missing', 404, {}, 'Not found'),
    corsProbe: exchange(url, 200, {}),
    corsProbeOrigin: 'https://sentinellab-cors-probe.invalid',
    ...overrides,
  };
}
