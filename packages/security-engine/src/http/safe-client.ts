import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { Agent, request } from 'undici';
import type { HeaderMap, HttpExchange } from '../types';
import { assertUrlAllowed, checkAddress, hostPortKey, TargetPolicyError, type TargetPolicy } from './target-policy';

export interface SafeRequestOptions {
  method?: 'GET' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  policy: TargetPolicy;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBodyBytes?: number;
}

export const USER_AGENT = 'SentinelLab/0.1 (+authorized security testing)';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BODY = 64 * 1024;

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * DNS lookup used for the actual TCP connection. It re-checks every resolved
 * address, so a host that passed validation and then changed its DNS record
 * to an internal address (DNS rebinding) is still refused at connect time.
 */
function guardedLookup(allowPrivate: boolean) {
  return (hostname: string, options: { all?: boolean; family?: number }, callback: LookupCallback) => {
    dnsLookup(hostname, { family: options.family ?? 0, all: true, verbatim: true }, (err, addresses) => {
      if (err) return callback(err, []);
      for (const { address } of addresses) {
        const reason = checkAddress(address, allowPrivate);
        if (reason) return callback(new TargetPolicyError(`Connection refused: ${reason}`), []);
      }
      if (options.all) return callback(null, addresses);
      const first = addresses[0];
      if (!first) return callback(new TargetPolicyError(`No addresses for ${hostname}`), []);
      callback(null, first.address, first.family);
    });
  };
}

function toHeaderMap(raw: Record<string, string | string[] | undefined>): HeaderMap {
  const out: HeaderMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value : [value];
  }
  return out;
}

/**
 * Make one HTTP request to an authorized target with SSRF protection,
 * a timeout, no automatic redirects and a cap on how much body is read.
 * Only safe methods are accepted: this client never sends a request body.
 */
export async function safeRequest(rawUrl: string, opts: SafeRequestOptions): Promise<HttpExchange> {
  const url = await assertUrlAllowed(rawUrl, opts.policy);
  const allowPrivate = opts.policy.privateHostAllowlist.includes(hostPortKey(url));
  const method = opts.method ?? 'GET';
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBody = opts.maxBodyBytes ?? DEFAULT_MAX_BODY;
  const headers = { 'user-agent': USER_AGENT, accept: '*/*', ...opts.headers };

  const agent = new Agent({
    connect: { lookup: guardedLookup(allowPrivate) as never, timeout: timeoutMs },
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  });
  const started = Date.now();
  try {
    // undici's request() never follows redirects on its own; recon follows
    // them manually so each hop goes through the policy check again.
    const res = await request(url, { method, headers, dispatcher: agent, signal: opts.signal });

    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    if (method !== 'HEAD') {
      for await (const chunk of res.body) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (size + buf.length > maxBody) {
          chunks.push(buf.subarray(0, maxBody - size));
          truncated = true;
          break;
        }
        chunks.push(buf);
        size += buf.length;
      }
    }
    if (truncated || method === 'HEAD') res.body.destroy();

    return {
      request: { method, url: url.toString(), headers },
      response: {
        status: res.statusCode,
        headers: toHeaderMap(res.headers),
        bodySnippet: Buffer.concat(chunks).toString('utf8'),
        bodyTruncated: truncated,
      },
      durationMs: Date.now() - started,
    };
  } finally {
    await agent.close().catch(() => undefined);
  }
}
