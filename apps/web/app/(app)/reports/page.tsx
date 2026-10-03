'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { PageHeader, Pagination } from '@/components/ui';
import { apiUrl } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Paginated, ReportItem } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function ReportsPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<ReportItem>>(`/reports?page=${page}&pageSize=20`);
  return (
    <>
      <PageHeader title="Reports" subtitle="Security assessment reports generated from completed scans." />
      <div className="panel overflow-x-auto">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={reload} />
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState title="No reports yet" body="Open a completed scan and choose Markdown report or HTML report. Each report covers scope, method, findings, evidence and remediation." action={{ href: '/scans', label: 'Go to scans' }} />
        ) : (
          data && (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Target</th>
                    <th>Format</th>
                    <th>Generated</th>
                    <th>By</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/scans/${r.scan.id}`} className="hover:underline">
                          {r.title}
                        </Link>
                      </td>
                      <td className="text-muted">{r.scan.target.name}</td>
                      <td>
                        <span className="mono text-xs">{r.format === 'HTML' ? '.html' : '.md'}</span>
                      </td>
                      <td className="whitespace-nowrap text-muted">{formatDate(r.createdAt)}</td>
                      <td className="text-muted">{r.generatedBy.name}</td>
                      <td className="text-right">
                        <a href={apiUrl(`/reports/${r.id}/download`)} className="btn-secondary px-2 py-1 text-xs">
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
            </>
          )
        )}
      </div>
      <p className="mt-4 text-xs text-faint">To get a PDF, open an HTML report in your browser and print it to PDF.</p>
    </>
  );
}
