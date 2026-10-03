import { parsePolicy, type TargetPolicy } from '@sentinellab/security-engine';

export interface DemoTargetDefinition {
  key: string;
  name: string;
  baseUrl: string;
  description: string;
}

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  /** BullMQ key prefix; separate prefixes keep dev, test and prod queues apart on one Redis. */
  queuePrefix: string;
  webOrigins: string[];
  cookieSecure: boolean;
  sessionTtlHours: number;
  allowRegistration: boolean;
  swaggerEnabled: boolean;
  /** Express trust proxy setting: false, or e.g. "loopback" / a CIDR list. */
  trustProxy: string | false;
  demoTargets: DemoTargetDefinition[];
  targetPolicy: TargetPolicy;
  scanTimeoutMs: number;
}

const DEFAULT_DEMO_TARGETS = 'vulnerable-web=http://localhost:8081/,vulnerable-api=http://localhost:8082/';

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable ${key}`);
  return value;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

/**
 * DEMO_TARGETS format: "key=url,key2=url2". Keys must be short slugs. Each
 * demo URL's host:port is added to the scanner's private-address allowlist,
 * which is the only way a local address becomes scannable.
 */
export function parseDemoTargets(raw: string): DemoTargetDefinition[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const eq = entry.indexOf('=');
      const key = entry.slice(0, eq).trim();
      const baseUrl = entry.slice(eq + 1).trim();
      if (eq === -1 || !/^[a-z0-9-]{1,40}$/.test(key)) throw new Error(`Invalid DEMO_TARGETS entry "${entry}"`);
      const url = new URL(baseUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`Demo target ${key} must use http or https`);
      return {
        key,
        baseUrl: url.toString(),
        name: `Demo: ${key}`,
        description: 'Intentionally vulnerable local training target. Runs only on your machine through Docker.',
      };
    });
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  if (!['development', 'production', 'test'].includes(nodeEnv)) throw new Error(`Invalid NODE_ENV "${nodeEnv}"`);

  const demoTargets = parseDemoTargets(env.DEMO_TARGETS ?? DEFAULT_DEMO_TARGETS);
  const demoHosts = demoTargets.map((d) => {
    const u = new URL(d.baseUrl);
    return `${u.hostname}:${u.port || (u.protocol === 'https:' ? '443' : '80')}`;
  });

  return {
    nodeEnv,
    port: Number(env.API_PORT ?? 4000),
    databaseUrl: required(env, 'DATABASE_URL'),
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
    queuePrefix: env.QUEUE_PREFIX ?? `sentinellab-${nodeEnv}`,
    webOrigins: (env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim()).filter(Boolean),
    cookieSecure: bool(env.COOKIE_SECURE, nodeEnv === 'production'),
    sessionTtlHours: Number(env.SESSION_TTL_HOURS ?? 12),
    allowRegistration: bool(env.ALLOW_REGISTRATION, true),
    swaggerEnabled: bool(env.SWAGGER_ENABLED, nodeEnv !== 'production'),
    trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY : false,
    demoTargets,
    targetPolicy: parsePolicy([...demoHosts, env.SCANNER_PRIVATE_ALLOWLIST ?? ''].join(',')),
    scanTimeoutMs: Number(env.SCAN_REQUEST_TIMEOUT_MS ?? 10_000),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
