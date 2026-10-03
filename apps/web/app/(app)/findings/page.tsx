'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { FINDING_STATUSES, FINDING_STATUS_LABELS, SEVERITIES, SEVERITY_LABELS } from '@sentinellab/types';
import { FindingsTable } from '@/components/findings-table';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { PageHeader, Pagination } from '@/components/ui';
import { qs } from '@/lib/api';
import type { FindingListItem, Paginated } from '@/lib/types';
import { useApi } from '@/lib/use-api';

function FindingsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const severity = params.get('severity') ?? '';
  const status = params.get('status') ?? '';
  const targetId = params.get('targetId') ?? '';
  const scanId = params.get('scanId') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const [q, setQ] = useState(params.get('q') ?? '');

  const { data, error, loading, reload } = useApi<Paginated<FindingListItem>>(
    `/findings${qs({ severity, status, targetId, scanId, q: params.get('q'), page, pageSize: 25 })}`,
  );

  function update(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) (v ? sp.set(k, v) : sp.delete(k));
    if (!('page' in next)) sp.delete('page');
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ''}`);
  }

  const filtered = Boolean(severity || status || targetId || scanId || params.get('q'));

  return (
    <>
      <PageHeader title="Findings" subtitle="Issues found across your targets, most severe first." />
      <form
        className="mb-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q });
        }}
      >
        <label className="sr-only" htmlFor="finding-search">
          Search findings
        </label>
        <input id="finding-search" className="input max-w-xs" placeholder="Search title, type or endpoint" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="sev-filter">
          Severity
        </label>
        <select id="sev-filter" className="input max-w-40" value={severity} onChange={(e) => update({ severity: e.target.value })}>
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="status-filter">
          Status
        </label>
        <select id="status-filter" className="input max-w-44" value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          {FINDING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FINDING_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Search
        </button>
        {filtered && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setQ('');
              router.replace(pathname);
            }}
          >
            Clear filters
          </button>
        )}
      </form>
      {(targetId || scanId) && <p className="mb-3 text-xs text-muted">Showing findings for one {scanId ? 'scan' : 'target'} only.</p>}
      <div className="panel overflow-x-auto">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={reload} />
          </div>
        ) : data && data.items.length === 0 ? (
          filtered ? (
            <EmptyState title="No matching findings" body="Nothing matches these filters. Clear them to see everything." />
          ) : (
            <EmptyState title="No findings yet" body="Findings appear after a scan completes. Start with a demo target if you want to see what results look like." action={{ href: '/demo-lab', label: 'Open the Demo Lab' }} />
          )
        ) : (
          data && (
            <>
              <FindingsTable items={data.items} />
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: String(p) })} />
            </>
          )
        )}
      </div>
    </>
  );
}

export default function FindingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <FindingsView />
    </Suspense>
  );
}
