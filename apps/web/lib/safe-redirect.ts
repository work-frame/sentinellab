/**
 * Only allow redirects to paths on this site. Rejects absolute URLs,
 * protocol-relative URLs (//evil.example) and backslash tricks.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  try {
    const url = new URL(raw, 'http://sentinellab.local');
    if (url.origin !== 'http://sentinellab.local') return '/';
    return `${url.pathname}${url.search}`;
  } catch {
    return '/';
  }
}
