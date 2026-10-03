'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EnvironmentTag, ScanStatusBadge } from '@/components/badges';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { PageHeader, Pagination } from '@/components/ui';
import { qs } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { Paginated, Target } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function TargetsPage() {
  const [q, setQ] = useState('');
  const [environment, setEnvironment] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<Target>>(`/targets${qs({ q, environment, page, pageSize: 20 })}`);
  const filtered = q !== '' || environment !== '';

  return (
    <>
      <PageHeader
        title="Targets"
        subtitle="Applications you are authorized to test."
        actions={
          <Link href="/targets/new" className="btn-primary">
            Add target
          </Link>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="target-search">
          Search targets
        </label>
        <input
          id="target-search"
          className="input max-w-xs"
          placeholder="Search name or URL"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <label className="sr-only" htmlFor="env-filter">
          Environment
        </label>
        <select
          id="env-filter"
          className="input max-w-44"
          value={environment}
          onChange={(e) => {
            setEnvironment(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All environments</option>
          <option value="LOCAL_DEMO">Local demo</option>
          <option value="DEVELOPMENT">Development</option>
          <option value="STAGING">Staging</option>
          <option value="PRODUCTION">Production</option>
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
          filtered ? (
            <EmptyState title="No matching targets" body="Try a different search or environment." />
          ) : (
            <EmptyState
              title="No targets yet"
              body="Register an application you are authorized to test. To try SentinelLab safely first, add a local demo target from the Demo Lab."
              action={{ href: '/targets/new', label: 'Add your first target' }}
            />
          )
        ) : (
          data && (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Base URL</th>
                    <th>Environment</th>
                    <th>Authorization</th>
                    <th>Last scan</th>
                    <th className="text-right">Open findings</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.id}>
                      <td className="font-medium">
                        <Link href={`/targets/${t.id}`} className="hover:underline">
                          {t.name}
                        </Link>
                        {!t.enabled && <span className="ml-2 text-xs font-normal text-faint">disabled</span>}
                      </td>
                      <td className="mono max-w-64 truncate text-xs text-muted">{t.baseUrl}</td>
                      <td>
                        <EnvironmentTag environment={t.environment} />
                      </td>
                      <td className="text-xs">{t.authorizationConfirmedAt ? <span className="text-ok">Confirmed</span> : <span className="text-warn">Required</span>}</td>
                      <td>
                        {t.lastScan ? (
                          <span className="flex items-center gap-2">
                            <ScanStatusBadge status={t.lastScan.status} />
                            <span className="text-xs text-muted">{timeAgo(t.lastScan.queuedAt)}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-faint">never</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{t.openFindings ?? 0}</td>
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
