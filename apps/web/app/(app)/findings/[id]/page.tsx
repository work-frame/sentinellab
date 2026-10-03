'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { FINDING_STATUSES, FINDING_STATUS_LABELS, type FindingStatus } from '@sentinellab/types';
import { FindingStatusBadge, SeverityBadge } from '@/components/badges';
import { EvidenceView } from '@/components/evidence-view';
import { ErrorState, Loading } from '@/components/states';
import { DemoWarning, Field, FormError, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Finding } from '@/lib/types';
import { useApi } from '@/lib/use-api';

function safeHref(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export default function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: f, error, loading, reload } = useApi<Finding>(`/findings/${id}`);

  if (loading) return <Loading />;
  if (error || !f) return <ErrorState error={error ?? new Error('Not found')} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title={f.title}
        crumbs={[
          { href: '/findings', label: 'Findings' },
          { href: `/scans/${f.scan.id}`, label: 'Scan' },
        ]}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={f.severity} />
            <FindingStatusBadge status={f.status} />
            <span className="text-xs">Confidence: {f.confidence.toLowerCase()}</span>
          </span>
        }
      />
      {f.target.isDemo && (
        <div className="mb-4">
          <DemoWarning />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="panel p-5">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="label">Affected endpoint</dt>
                <dd className="mono text-xs break-all">
                  {f.method} {f.endpoint}
                </dd>
              </div>
              <div>
                <dt className="label">Type</dt>
                <dd>{f.type}</dd>
              </div>
              <div>
                <dt className="label">Target</dt>
                <dd>
                  <Link href={`/targets/${f.target.id}`} className="hover:underline">
                    {f.target.name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="label">Discovered</dt>
                <dd>{formatDate(f.createdAt)}</dd>
              </div>
              <div>
                <dt className="label">Scanner module</dt>
                <dd className="mono text-xs">{f.module}</dd>
              </div>
            </dl>
          </section>
          <section className="panel space-y-4 p-5">
            <div>
              <h2 className="text-sm font-semibold">Description</h2>
              <p className="mt-1 text-sm text-muted">{f.description}</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold">Impact</h2>
              <p className="mt-1 text-sm text-muted">{f.impact}</p>
            </div>
            <div className="rounded-md border border-ok/30 bg-ok/5 p-4">
              <h2 className="text-sm font-semibold text-ok">Remediation</h2>
              <p className="mt-1 text-sm">{f.remediation}</p>
            </div>
            {f.references.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold">References</h2>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {f.references.map((r) => {
                    const href = safeHref(r);
                    return (
                      <li key={r}>
                        {href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">
                            {r}
                          </a>
                        ) : (
                          <span className="break-all">{r}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
          <section className="panel p-5" aria-labelledby="evidence-heading">
            <h2 id="evidence-heading" className="mb-1 text-sm font-semibold">
              Evidence
            </h2>
            <p className="mb-4 text-xs text-faint">Cookie values, credential headers and secret-like strings were replaced with [REDACTED] before storage.</p>
            <div className="space-y-6">
              {f.evidence.map((e) => (
                <EvidenceView key={e.id} evidence={e} />
              ))}
            </div>
          </section>
        </div>
        <aside>
          <StatusEditor finding={f} onSaved={reload} />
        </aside>
      </div>
    </>
  );
}

function StatusEditor({ finding, onSaved }: { finding: Finding; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState<FindingStatus>(finding.status);
  const [note, setNote] = useState(finding.statusNote ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="panel space-y-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        setSaved(false);
        try {
          await api(`/findings/${finding.id}/status`, { method: 'PATCH', body: { status, note: note || undefined } });
          await onSaved();
          setSaved(true);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-sm font-semibold">Triage</h2>
      <FormError message={error} />
      <Field label="Status" htmlFor="status">
        <select id="status" className="input" value={status} onChange={(e) => setStatus(e.target.value as FindingStatus)}>
          {FINDING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FINDING_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note" htmlFor="note" hint="False positives and accepted risks carry over to later scans of the same issue.">
        <textarea id="note" className="input min-h-20" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save status'}
      </button>
      {saved && (
        <p role="status" className="text-xs text-ok">
          Saved.
        </p>
      )}
      {finding.statusChangedAt && <p className="text-xs text-faint">Last changed {formatDate(finding.statusChangedAt)}</p>}
    </form>
  );
}
