'use client';

import Link from 'next/link';
import { SEVERITIES, SEVERITY_LABELS } from '@sentinellab/types';
import { FindingStatusBadge, ScanStatusBadge, SeverityBadge } from '@/components/badges';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { PageHeader, Stat } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import type { Dashboard } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const SEV_BAR: Record<string, string> = {
  CRITICAL: 'bg-sev-critical',
  HIGH: 'bg-sev-high',
  MEDIUM: 'bg-sev-medium',
  LOW: 'bg-sev-low',
  INFO: 'bg-sev-info',
};

export default function DashboardPage() {
  const { data, error, loading, reload } = useApi<Dashboard>('/dashboard', {
    pollMs: 4000,
    shouldPoll: (d) => d.scans.active > 0,
  });

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? new Error('No data')} onRetry={reload} />;

  const noTargets = data.targetHealth.length === 0;
  const maxSev = Math.max(1, ...Object.values(data.findings.openBySeverity));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live numbers from your targets and scans."
        actions={
          <Link href="/targets/new" className="btn-primary">
            Add target
          </Link>
        }
      />

      {noTargets ? (
        <div className="panel">
          <EmptyState
            title="No targets yet"
            body="Add an application you own or have permission to test, or start with an intentionally vulnerable demo target from the Demo Lab. Statistics appear here after your first scan."
            action={{ href: '/demo-lab', label: 'Open the Demo Lab' }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-label="Scan statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total scans" value={data.scans.total} />
            <Stat label="Completed" value={data.scans.completed} tone="text-ok" />
            <Stat label="Active" value={data.scans.active} tone={data.scans.active ? 'text-info' : undefined} hint={data.scans.active ? 'Refreshing every 4 s' : undefined} />
            <Stat label="Open findings" value={data.findings.open} tone={data.findings.open ? 'text-warn' : undefined} hint={`${data.findings.total} found in total`} />
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="panel p-4 lg:col-span-2" aria-labelledby="sev-heading">
              <h2 id="sev-heading" className="mb-4 text-sm font-semibold">
                Open findings by severity
              </h2>
              {data.findings.open === 0 ? (
                <p className="text-sm text-muted">No open findings. That covers only what the checks look for; it is not proof of security.</p>
              ) : (
                <ul className="space-y-3">
                  {SEVERITIES.map((s) => {
                    const n = data.findings.openBySeverity[s] ?? 0;
                    return (
                      <li key={s}>
                        <Link href={`/findings?severity=${s}&status=OPEN`} className="group block">
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-muted group-hover:text-text">{SEVERITY_LABELS[s]}</span>
                            <span className="font-medium tabular-nums">{n}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-panel-2">
                            <div className={`h-1.5 rounded-full ${SEV_BAR[s]}`} style={{ width: `${(n / maxSev) * 100}%` }} />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="panel lg:col-span-3" aria-labelledby="recent-findings">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 id="recent-findings" className="text-sm font-semibold">
                  Recently discovered
                </h2>
                <Link href="/findings" className="text-xs text-muted hover:text-text">
                  All findings
                </Link>
              </div>
              {data.recentFindings.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted">Nothing yet. Findings show up here after a scan completes.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentFindings.map((f) => (
                    <li key={f.id}>
                      <Link href={`/findings/${f.id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-panel-2">
                        <SeverityBadge severity={f.severity} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{f.title}</span>
                          <span className="block truncate text-xs text-muted">
                            {f.target.name} · {timeAgo(f.createdAt)}
                          </span>
                        </span>
                        <FindingStatusBadge status={f.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="panel" aria-labelledby="target-health">
              <h2 id="target-health" className="px-4 pt-4 pb-2 text-sm font-semibold">
                Target health
              </h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Last scan</th>
                    <th className="text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {data.targetHealth.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/targets/${t.id}`} className="hover:underline">
                          {t.name}
                        </Link>
                        {!t.enabled && <span className="ml-2 text-xs text-faint">disabled</span>}
                        {!t.authorized && <span className="ml-2 text-xs text-warn">needs authorization</span>}
                      </td>
                      <td>{t.lastScanStatus ? <ScanStatusBadge status={t.lastScanStatus} /> : <span className="text-xs text-faint">never scanned</span>}</td>
                      <td className="text-right tabular-nums">{t.openFindings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="panel" aria-labelledby="scan-history">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 id="scan-history" className="text-sm font-semibold">
                  Scan history
                </h2>
                <Link href="/scans" className="text-xs text-muted hover:text-text">
                  All scans
                </Link>
              </div>
              {data.recentScans.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted">No scans yet. Open a target and start one.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Target</th>
                      <th>Status</th>
                      <th>Queued</th>
                      <th className="text-right">Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentScans.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <Link href={`/scans/${s.id}`} className="hover:underline">
                            {s.target.name}
                          </Link>
                        </td>
                        <td>
                          <ScanStatusBadge status={s.status} />
                        </td>
                        <td className="text-muted">{timeAgo(s.queuedAt)}</td>
                        <td className="text-right tabular-nums">{s.findingCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
