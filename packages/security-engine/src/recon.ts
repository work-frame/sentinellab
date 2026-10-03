import { randomBytes } from 'node:crypto';
import { safeRequest } from './http/safe-client';
import type { TargetPolicy } from './http/target-policy';
import type { HttpExchange, ReconResult } from './types';

export const CORS_PROBE_ORIGIN = 'https://sentinellab-cors-probe.invalid';
const MAX_REDIRECTS = 5;

export interface ReconOptions {
  policy: TargetPolicy;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Collect the HTTP responses that every check reads. Recon sends at most
 * MAX_REDIRECTS + 4 requests, all with safe methods (GET and OPTIONS).
 * Redirects are followed only while they stay on the same host, so a target
 * cannot steer the scanner to a host the user never authorized.
 */
export async function runRecon(baseUrl: string, opts: ReconOptions): Promise<ReconResult> {
  const common = { policy: opts.policy, signal: opts.signal, timeoutMs: opts.timeoutMs };
  const redirects: HttpExchange[] = [];
  const startHost = new URL(baseUrl).hostname;

  let current = baseUrl;
  let baseline = await safeRequest(current, common);
  while (baseline.response.status >= 300 && baseline.response.status < 400 && redirects.length < MAX_REDIRECTS) {
    const location = baseline.response.headers['location']?.[0];
    if (!location) break;
    const next = new URL(location, current);
    if (next.hostname !== startHost || !['http:', 'https:'].includes(next.protocol)) break;
    redirects.push(baseline);
    current = next.toString();
    baseline = await safeRequest(current, common);
  }

  // The optional probes must not fail the whole scan, but a policy violation
  // or cancellation still has to stop it, so only network errors are ignored.
  const optional = async (fn: () => Promise<HttpExchange>): Promise<HttpExchange | undefined> => {
    try {
      return await fn();
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      if (err instanceof Error && err.name === 'TargetPolicyError') throw err;
      return undefined;
    }
  };

  const notFoundPath = `/sentinellab-not-found-${randomBytes(6).toString('hex')}`;
  const options = await optional(() => safeRequest(current, { ...common, method: 'OPTIONS' }));
  const notFound = await optional(() => safeRequest(new URL(notFoundPath, current).toString(), common));
  const corsProbe = await optional(() => safeRequest(current, { ...common, headers: { origin: CORS_PROBE_ORIGIN } }));

  return { baseUrl, baseline, redirects, options, notFound, corsProbe, corsProbeOrigin: CORS_PROBE_ORIGIN };
}
