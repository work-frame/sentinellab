/**
 * Small fetch wrapper for the SentinelLab API. The browser calls the API
 * origin directly (so the API sees the real client IP), sends the session
 * cookie with credentials: 'include', and adds the CSRF header the API
 * requires on state-changing requests. The API only allows this web origin.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/** Absolute URL for an API path, for links such as report downloads. */
export function apiUrl(path: string): string {
  return `${API_URL}/api${path}`;
}
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

function messageFrom(body: unknown, status: number): string {
  const msg = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(msg)) return msg.join('. ');
  if (typeof msg === 'string') return msg;
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  return `Request failed (${status})`;
}

export async function api<T = unknown>(path: string, init: { method?: Method; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (method !== 'GET') headers['x-sentinellab-csrf'] = '1';
  if (init.body !== undefined) headers['content-type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers,
      credentials: 'include',
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Could not reach the SentinelLab API. Check that it is running.');
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageFrom(body, res.status));
  return body as T;
}

/** Build a query string, skipping empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}
