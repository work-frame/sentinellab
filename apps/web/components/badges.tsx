import { FINDING_STATUS_LABELS, SEVERITY_LABELS, type FindingStatus, type ScanStatus, type Severity } from '@sentinellab/types';

const SEVERITY_CLASS: Record<Severity, string> = {
  CRITICAL: 'text-sev-critical border-sev-critical/40 bg-sev-critical/10',
  HIGH: 'text-sev-high border-sev-high/40 bg-sev-high/10',
  MEDIUM: 'text-sev-medium border-sev-medium/40 bg-sev-medium/10',
  LOW: 'text-sev-low border-sev-low/40 bg-sev-low/10',
  INFO: 'text-sev-info border-sev-info/40 bg-sev-info/10',
};

/** Severity is shown as text plus a shape, never by color alone. */
const SEVERITY_GLYPH: Record<Severity, string> = { CRITICAL: '◆', HIGH: '▲', MEDIUM: '●', LOW: '▼', INFO: '○' };

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${SEVERITY_CLASS[severity]}`}>
      <span aria-hidden="true">{SEVERITY_GLYPH[severity]}</span>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

const SCAN_CLASS: Record<ScanStatus, string> = {
  QUEUED: 'text-muted border-line-strong',
  RUNNING: 'text-info border-info/40 bg-info/10',
  COMPLETED: 'text-ok border-ok/40 bg-ok/10',
  FAILED: 'text-danger border-danger/40 bg-danger/10',
  CANCELLED: 'text-faint border-line-strong',
};

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${SCAN_CLASS[status]}`}>
      {status === 'RUNNING' && <span className="size-1.5 animate-pulse rounded-full bg-info" aria-hidden="true" />}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

const FINDING_CLASS: Record<FindingStatus, string> = {
  OPEN: 'text-warn border-warn/40',
  CONFIRMED: 'text-danger border-danger/40',
  FALSE_POSITIVE: 'text-faint border-line-strong',
  RESOLVED: 'text-ok border-ok/40',
  ACCEPTED_RISK: 'text-muted border-line-strong',
};

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  return <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs whitespace-nowrap ${FINDING_CLASS[status]}`}>{FINDING_STATUS_LABELS[status]}</span>;
}

export function EnvironmentTag({ environment }: { environment: string }) {
  const label = { LOCAL_DEMO: 'Local demo', DEVELOPMENT: 'Dev', STAGING: 'Staging', PRODUCTION: 'Prod' }[environment] ?? environment;
  const cls = environment === 'PRODUCTION' ? 'text-danger border-danger/40' : environment === 'LOCAL_DEMO' ? 'text-warn border-warn/40' : 'text-muted border-line-strong';
  return <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase ${cls}`}>{label}</span>;
}
