import type { HeaderMap } from '../types';

const REDACTED = '[REDACTED]';

/** Headers whose values are credentials or session material. */
const SECRET_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie', 'x-api-key', 'x-auth-token']);

/**
 * Patterns for secrets that often leak into response bodies. Matches are
 * replaced so stored evidence never holds a usable credential.
 */
const BODY_PATTERNS: Array<[RegExp, string]> = [
  // JSON Web Tokens
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, REDACTED],
  // "password": "...", "secret": "...", "token": "...", "api_key": "..."
  [
    /("(?:password|passwd|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)"\s*:\s*")[^"]*(")/gi,
    `$1${REDACTED}$2`,
  ],
  // password=... in query strings or form bodies
  [/((?:password|passwd|secret|token|api[_-]?key)=)[^&\s"'<]+/gi, `$1${REDACTED}`],
  // AWS access key IDs
  [/\bAKIA[0-9A-Z]{16}\b/g, REDACTED],
  // Private key blocks
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, REDACTED],
];

export function redactBody(text: string): string {
  return BODY_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

/** Keep the cookie name and attributes, drop the value. */
export function redactSetCookie(value: string): string {
  const [pair, ...attrs] = value.split(';');
  const eq = (pair ?? '').indexOf('=');
  const name = eq === -1 ? (pair ?? '').trim() : (pair ?? '').slice(0, eq).trim();
  return [`${name}=${REDACTED}`, ...attrs.map((a) => a.trim())].join('; ');
}

export function redactHeaders(headers: HeaderMap): HeaderMap {
  const out: HeaderMap = {};
  for (const [key, values] of Object.entries(headers)) {
    if (SECRET_HEADERS.has(key)) out[key] = values.map(() => REDACTED);
    else if (key === 'set-cookie') out[key] = values.map(redactSetCookie);
    else out[key] = values;
  }
  return out;
}

export function redactRequestHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SECRET_HEADERS.has(key.toLowerCase()) ? REDACTED : value;
  }
  return out;
}
