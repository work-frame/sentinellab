'use client';

import { useState } from 'react';
import { useUser } from '@/components/app-shell';
import { ErrorState, Loading } from '@/components/states';
import { PageHeader, Pagination } from '@/components/ui';
import { formatDate } from '@/lib/format';
import type { AuditEntry, Paginated } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function SettingsPage() {
  const user = useUser();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<AuditEntry>>(`/audit-logs?page=${page}&pageSize=20`);

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account and security activity." />
      <section className="panel mb-6 max-w-xl p-5" aria-labelledby="account">
        <h2 id="account" className="mb-3 text-sm font-semibold">
          Account
        </h2>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Name</dt>
          <dd>{user?.name}</dd>
          <dt className="text-muted">Email</dt>
          <dd>{user?.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd>{user?.role === 'ADMIN' ? 'Administrator' : 'Member'}</dd>
          <dt className="text-muted">Member since</dt>
          <dd>{formatDate(user?.createdAt)}</dd>
        </dl>
        <p className="mt-4 text-xs text-faint">Sessions expire after 12 hours. Accounts lock for 15 minutes after 10 failed sign-in attempts.</p>
      </section>

      <section className="panel overflow-x-auto" aria-labelledby="audit">
        <div className="px-4 pt-4 pb-2">
          <h2 id="audit" className="text-sm font-semibold">
            Audit log
          </h2>
          <p className="text-xs text-muted">{user?.role === 'ADMIN' ? 'All users. You see everything as an administrator.' : 'Your own security-relevant actions.'}</p>
        </div>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={reload} />
          </div>
        ) : (
          data && (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Resource</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap text-muted">{formatDate(a.createdAt)}</td>
                      <td className="mono text-xs">{a.action}</td>
                      <td className="text-muted">{a.actor?.email ?? '—'}</td>
                      <td className="mono text-xs text-muted">{a.resourceType ? `${a.resourceType}:${a.resourceId?.slice(0, 8)}` : '—'}</td>
                      <td className="mono text-xs text-muted">{a.ipAddress ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
            </>
          )
        )}
      </section>
    </>
  );
}
