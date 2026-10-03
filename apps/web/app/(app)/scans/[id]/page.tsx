'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { SEVERITIES } from '@sentinellab/types';
import { ScanStatusBadge, SeverityBadge } from '@/components/badges';
import { FindingsTable } from '@/components/findings-table';
import { ErrorState, Loading } from '@/components/states';
import { ConfirmButton, DemoWarning, FormError, PageHeader } from '@/components/ui';
import { api, apiUrl } from '@/lib/api';
import { duration, formatDate } from '@/lib/format';
import type { FindingListItem, Paginated, Scan } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const MODULE_STATUS: Record<string, string> = {
  PENDING: 'text-faint',
  RUNNING: 'text-info',
  COMPLETED: 'text-ok',
  FAILED: 'text-danger',
  SKIPPED: 'text-faint',
};

const isActive = (s: Scan) => s.status === 'QUEUED' || s.status === 'RUNNING';

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const scan = useApi<Scan>(`/scans/${id}`, { pollMs: 1500, shouldPoll: isActive });
  const done = scan.data?.status === 'COMPLETED';
  const findings = useApi<Paginated<FindingListItem>>(done ? `/findings?scanId=${id}&pageSize=100` : null);
  const [error, setError] = useState<string>();
  const [generating, setGenerating] = useState<string | null>(null);

  if (scan.loading) return <Loading />;
  if (scan.error || !scan.data) return <ErrorState error={scan.error ?? new Error('Not found')} onRetry={scan.reload} />;
  const s = scan.data;

  async function generate(format: 'MARKDOWN' | 'HTML') {
    setGenerating(format);
    setError(undefined);
    try {
      const report = await api<{ id: string }>(`/scans/${id}/reports`, { method: 'POST', body: { format } });
      // Trigger the file download without leaving the page.
      const link = document.createElement('a');
      link.href = apiUrl(`/reports/${report.id}/download`);
      link.download = '';
      link.click();
      await scan.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(null);
    }
  }

  return (
    <>
      <PageHeader
        title={`Scan of ${s.target.name}`}
        crumbs={[
          { href: '/scans', label: 'Scans' },
          { href: `/targets/${s.target.id}`, label: s.target.name },
        ]}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <ScanStatusBadge status={s.status} />
            <span className="mono text-xs">{s.targetUrl}</span>
          </span>
        }
        actions={
          isActive(s) ? (
            <ConfirmButton
              label={s.cancelRequested ? 'Cancelling…' : 'Cancel scan'}
              confirmLabel="Yes, cancel"
              disabled={s.cancelRequested}
              onConfirm={async () => {
                try {
                  await api(`/scans/${id}/cancel`, { method: 'POST' });
                  await scan.reload();
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
          ) : done ? (
            <>
              <button type="button" className="btn-secondary" disabled={generating !== null} onClick={() => generate('MARKDOWN')}>
                {generating === 'MARKDOWN' ? 'Generating…' : 'Markdown report'}
              </button>
              <button type="button" className="btn-primary" disabled={generating !== null} onClick={() => generate('HTML')}>
                {generating === 'HTML' ? 'Generating…' : 'HTML report'}
              </button>
            </>
          ) : null
        }
      />
      {s.target.isDemo && (
        <div className="mb-4">
          <DemoWarning />
        </div>
      )}
      <div className="mb-4">
        <FormError message={error} />
      </div>
      {s.status === 'FAILED' && (
        <div role="alert" className="panel mb-6 border-danger/40 p-4 text-sm">
          <p className="font-medium text-danger">The scan failed</p>
          <p className="mt-1 text-muted">{s.error ?? 'No details were recorded.'}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel p-4" aria-labelledby="progress-heading">
          <h2 id="progress-heading" className="mb-3 text-sm font-semibold">
            Progress
          </h2>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>{isActive(s) ? (s.currentModule ? `Running ${s.currentModule}` : 'Waiting for a worker') : s.status.toLowerCase()}</span>
            <span className="tabular-nums">{s.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-panel-2" role="progressbar" aria-valuenow={s.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Scan progress">
            <div className="h-2 rounded-full bg-accent transition-all" style={{ width: `${s.progress}%` }} />
          </div>
          <ol className="mt-4 space-y-1.5 text-sm">
            {(s.modules ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="mono text-xs">{m.name}</span>
                <span className={`text-xs ${MODULE_STATUS[m.status]}`}>
                  {m.status.toLowerCase()}
                  {m.status === 'COMPLETED' && m.name !== 'recon' ? ` · ${m.findingCount}` : ''}
                </span>
              </li>
            ))}
            {(s.modules ?? []).length === 0 && <li className="text-xs text-muted">Modules appear once a worker picks up the scan.</li>}
          </ol>
          <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 text-xs">
            <dt className="text-muted">Queued</dt>
            <dd>{formatDate(s.queuedAt)}</dd>
            <dt className="text-muted">Started</dt>
            <dd>{formatDate(s.startedAt)}</dd>
            <dt className="text-muted">Duration</dt>
            <dd>{duration(s.startedAt, s.finishedAt)}</dd>
            <dt className="text-muted">Requests sent</dt>
            <dd>{s.requestCount ?? '—'}</dd>
            {s.requestedBy && (
              <>
                <dt className="text-muted">Started by</dt>
                <dd className="truncate">{s.requestedBy.name}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="panel lg:col-span-2" aria-labelledby="scan-findings">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
            <h2 id="scan-findings" className="text-sm font-semibold">
              Findings
            </h2>
            <span className="flex flex-wrap gap-1.5">
              {SEVERITIES.filter((sev) => s.findingsBySeverity?.[sev]).map((sev) => (
                <span key={sev} className="inline-flex items-center gap-1 text-xs">
                  <SeverityBadge severity={sev} />
                  <span className="tabular-nums">{s.findingsBySeverity?.[sev]}</span>
                </span>
              ))}
            </span>
          </div>
          {!done ? (
            <p className="px-4 pb-4 text-sm text-muted">{isActive(s) ? 'Findings appear when the scan completes.' : 'This scan did not complete, so it has no findings.'}</p>
          ) : findings.loading ? (
            <Loading />
          ) : findings.error ? (
            <div className="p-4">
              <ErrorState error={findings.error} onRetry={findings.reload} />
            </div>
          ) : findings.data?.items.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted">No findings. The checks listed on the left found nothing to report. This does not prove the target is secure.</p>
          ) : (
            <div className="overflow-x-auto">
              <FindingsTable items={findings.data?.items ?? []} showTarget={false} />
            </div>
          )}
          {s.reports && s.reports.length > 0 && (
            <div className="border-t border-line px-4 py-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted uppercase">Reports</p>
              <ul className="space-y-1">
                {s.reports.map((r) => (
                  <li key={r.id}>
                    <a className="text-accent hover:underline" href={apiUrl(`/reports/${r.id}/download`)}>
                      {r.format === 'HTML' ? 'HTML' : 'Markdown'} report
                    </a>
                    <span className="ml-2 text-xs text-muted">{formatDate(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
      <p className="mt-6 text-xs text-faint">
        Looking for something specific? <Link href={`/findings?scanId=${id}`} className="underline">Filter this scan&apos;s findings</Link>.
      </p>
    </>
  );
}
