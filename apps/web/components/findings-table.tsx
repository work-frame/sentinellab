'use client';

import Link from 'next/link';
import { timeAgo } from '@/lib/format';
import type { FindingListItem } from '@/lib/types';
import { FindingStatusBadge, SeverityBadge } from './badges';

export function FindingsTable({ items, showTarget = true }: { items: FindingListItem[]; showTarget?: boolean }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Severity</th>
          <th>Finding</th>
          {showTarget && <th>Target</th>}
          <th>Status</th>
          <th>Found</th>
        </tr>
      </thead>
      <tbody>
        {items.map((f) => (
          <tr key={f.id}>
            <td>
              <SeverityBadge severity={f.severity} />
            </td>
            <td className="min-w-64">
              <Link href={`/findings/${f.id}`} className="font-medium hover:underline">
                {f.title}
              </Link>
              <p className="mono mt-0.5 truncate text-xs text-muted">
                {f.method} {f.endpoint}
              </p>
            </td>
            {showTarget && (
              <td>
                <Link href={`/targets/${f.target.id}`} className="text-muted hover:text-text">
                  {f.target.name}
                </Link>
              </td>
            )}
            <td>
              <FindingStatusBadge status={f.status} />
            </td>
            <td className="whitespace-nowrap text-muted">{timeAgo(f.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
