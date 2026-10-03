const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const dtf = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(iso: string | null | undefined): string {
  return iso ? dtf.format(new Date(iso)) : '—';
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const diff = (new Date(iso).getTime() - now) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  return 'just now';
}

export function duration(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return '—';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 100) / 10;
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

export const ENVIRONMENT_LABELS: Record<string, string> = {
  LOCAL_DEMO: 'Local demo',
  DEVELOPMENT: 'Development',
  STAGING: 'Staging',
  PRODUCTION: 'Production',
};
