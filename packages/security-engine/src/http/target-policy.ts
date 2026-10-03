import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

/**
 * SSRF guard. SentinelLab only talks to public addresses, plus an explicit
 * allowlist of host:port pairs (the local demo targets). The allowlist is
 * exact: allowing "demo-target:8080" does not open any other port on that
 * host, and it never opens link-local, multicast or unspecified addresses
 * such as the cloud metadata endpoint 169.254.169.254.
 */
export interface TargetPolicy {
  /** Lowercase "host:port" entries allowed to resolve to private addresses. */
  privateHostAllowlist: string[];
}

export class TargetPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TargetPolicyError';
  }
}

/** Ranges that are never reachable, even for allowlisted hosts. */
const ALWAYS_BLOCKED = new Set([
  'unspecified',
  'broadcast',
  'multicast',
  'linkLocal',
  'reserved',
  'benchmarking',
  'amt',
  'as112',
  'deprecated',
  'orchid2',
  'rfc6145',
  'rfc6052',
  '6to4',
  'teredo',
  'discard',
]);

/** Ranges that are reachable only for allowlisted host:port pairs. */
const PRIVATE_RANGES = new Set(['private', 'loopback', 'uniqueLocal', 'carrierGradeNat']);

export function parsePolicy(allowlist: string | undefined): TargetPolicy {
  const entries = (allowlist ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return { privateHostAllowlist: entries };
}

export function hostPortKey(url: URL): string {
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  // URL keeps brackets around IPv6 literals; drop them for the allowlist key.
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return `${host}:${port}`;
}

/**
 * Classify one IP address. Returns null when the address is allowed, or a
 * human-readable reason when it is not.
 */
export function checkAddress(address: string, allowPrivate: boolean): string | null {
  if (!ipaddr.isValid(address)) return `"${address}" is not a valid IP address`;
  let parsed = ipaddr.parse(address);
  if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
    parsed = (parsed as ipaddr.IPv6).toIPv4Address();
  }
  const range = parsed.range();
  if (range === 'unicast') return null;
  if (ALWAYS_BLOCKED.has(range)) return `address ${address} is in a blocked range (${range})`;
  if (PRIVATE_RANGES.has(range)) {
    return allowPrivate ? null : `address ${address} is internal (${range}) and not on the allowlist`;
  }
  return `address ${address} is in an unsupported range (${range})`;
}

/** Static checks that need no DNS: scheme, credentials, port. */
export function parseTargetUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TargetPolicyError('Target URL is not a valid absolute URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TargetPolicyError('Only http and https targets are supported');
  }
  if (url.username || url.password) {
    throw new TargetPolicyError('Target URL must not contain credentials');
  }
  if (!url.hostname) throw new TargetPolicyError('Target URL has no host');
  return url;
}

/**
 * Resolve the host and confirm every address it resolves to is allowed.
 * Rejecting when *any* address is internal stops a hostname from mixing a
 * public and an internal record to slip past the check.
 */
export async function assertUrlAllowed(raw: string, policy: TargetPolicy): Promise<URL> {
  const url = parseTargetUrl(raw);
  const allowPrivate = policy.privateHostAllowlist.includes(hostPortKey(url));
  const host = url.hostname.replace(/^\[|\]$/g, '');

  const addresses = isIP(host)
    ? [host]
    : await lookup(host, { all: true, verbatim: true })
        .then((r) => r.map((a) => a.address))
        .catch(() => {
          throw new TargetPolicyError(`Could not resolve host "${host}"`);
        });

  if (addresses.length === 0) throw new TargetPolicyError(`Host "${host}" has no addresses`);
  for (const address of addresses) {
    const reason = checkAddress(address, allowPrivate);
    if (reason) throw new TargetPolicyError(`Target not allowed: ${reason}`);
  }
  return url;
}
