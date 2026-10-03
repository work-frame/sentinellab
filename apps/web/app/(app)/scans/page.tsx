'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SCAN_STATUSES } from '@sentinellab/types';
import { ScanStatusBadge } from '@/components/badges';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { PageHeader, Pagination } from '@/components/ui';
import { qs } from '@/lib/api';
import { duration, formatDate } from '@/lib/format';
import type { Paginated, Scan } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function ScansPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<Scan>>(`/scans${qs({ status, page, pageSize: 20 })}`, {
    pollMs: 3000,
    shouldPoll: (d) => d.items.some((s) => s.status === 'QUEUED' || s.status === 'RUNNING'),
  });

  return (
    <>
      <PageHeader title="Scans" subtitle="Every scan you have queued, newest first." />
      <div className="mb-3">
        <label className="sr-only" htmlFor="status-filter">
          Status
        </label>
        <select
          id="status-filter"
          className="input max-w-44"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {SCAN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <div className="panel overflow-x-auto">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={reload} />
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title={status ? 'No scans with this status' : 'No scans yet'}
            body={status ? 'Pick another status filter.' : 'Open an authorized target and start a scan. Scans run in the background, so you can leave the page.'}
            action={status ? undefined : { href: '/targets', label: 'Go to targets' }}
          />
        ) : (
          data && (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Queued</th>
                    <th>Duration</th>
                    <th className="text-right">Findings</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/scans/${s.id}`} className="font-medium hover:underline">
                          {s.target.name}
                        </Link>
                      </td>
                      <td>
                        <ScanStatusBadge status={s.status} />
                      </td>
                      <td className="w-36">
                        <div className="h-1.5 rounded-full bg-panel-2" role="progressbar" aria-valuenow={s.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Scan progress">
                          <div className="h-1.5 rounded-full bg-accent" style={{ width: `${s.progress}%` }} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-muted">{formatDate(s.queuedAt)}</td>
                      <td className="text-muted">{duration(s.startedAt, s.finishedAt)}</td>
                      <td className="text-right tabular-nums">{s.findingCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
            </>
          )
        )}
      </div>
    </>
  );
}
