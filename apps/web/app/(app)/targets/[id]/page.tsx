'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { SEVERITIES } from '@sentinellab/types';
import { EnvironmentTag, ScanStatusBadge, SeverityBadge } from '@/components/badges';
import { ErrorState, Loading } from '@/components/states';
import { TargetForm } from '@/components/target-form';
import { ConfirmButton, DemoWarning, Field, FormError, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, timeAgo } from '@/lib/format';
import type { Paginated, Scan, Target } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function TargetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const target = useApi<Target>(`/targets/${id}`);
  const scans = useApi<Paginated<Scan>>(`/scans?targetId=${id}&pageSize=10`, {
    pollMs: 3000,
    shouldPoll: (d) => d.items.some((s) => s.status === 'QUEUED' || s.status === 'RUNNING'),
  });
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [starting, setStarting] = useState(false);

  if (target.loading) return <Loading />;
  if (target.error || !target.data) return <ErrorState error={target.error ?? new Error('Not found')} onRetry={target.reload} />;
  const t = target.data;
  const active = scans.data?.items.find((s) => s.status === 'QUEUED' || s.status === 'RUNNING');
  const canScan = t.enabled && Boolean(t.authorizationConfirmedAt) && !active;

  async function run<T>(fn: () => Promise<T>) {
    setActionError(undefined);
    try {
      await fn();
      await Promise.all([target.reload(), scans.reload()]);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function startScan() {
    setStarting(true);
    setActionError(undefined);
    try {
      const scan = await api<Scan>(`/targets/${id}/scans`, { method: 'POST' });
      router.push(`/scans/${scan.id}`);
    } catch (err) {
      setActionError((err as Error).message);
      setStarting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t.name}
        crumbs={[{ href: '/targets', label: 'Targets' }]}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="mono text-xs">{t.baseUrl}</span>
            <EnvironmentTag environment={t.environment} />
            {!t.enabled && <span className="text-xs text-faint">Disabled</span>}
          </span>
        }
        actions={
          <>
            <button type="button" className="btn-primary" disabled={!canScan || starting} onClick={startScan} title={canScan ? undefined : 'Target must be enabled, authorized and idle'}>
              {starting ? 'Queuing…' : 'Start scan'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing((e) => !e)}>
              {editing ? 'Close editor' : 'Edit'}
            </button>
          </>
        }
      />
      {t.isDemo && (
        <div className="mb-4">
          <DemoWarning />
        </div>
      )}
      <div className="mb-4">
        <FormError message={actionError} />
      </div>

      {!t.authorizationConfirmedAt && <AuthorizeCard onAuthorize={(note) => run(() => api(`/targets/${id}/authorize`, { method: 'POST', body: { confirm: true, note: note || undefined } }))} />}

      {editing && (
        <section className="panel mb-6 max-w-2xl p-6" aria-label="Edit target">
          <TargetForm
            initial={t}
            submitLabel="Save changes"
            showAuthorization={false}
            onSubmit={async (v) => {
              const body: Record<string, unknown> = { name: v.name, description: v.description };
              if (!t.isDemo) Object.assign(body, { baseUrl: v.baseUrl, environment: v.environment });
              await api(`/targets/${id}`, { method: 'PATCH', body });
              setEditing(false);
              await target.reload();
            }}
          />
          {!t.isDemo && <p className="mt-3 text-xs text-muted">Changing the base URL removes the authorization confirmation. You will need to confirm again for the new URL.</p>}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel p-4 lg:col-span-1" aria-label="Target details">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="label">Authorization</dt>
              <dd>{t.authorizationConfirmedAt ? <span className="text-ok">Confirmed {formatDate(t.authorizationConfirmedAt)}</span> : <span className="text-warn">Not confirmed</span>}</dd>
              {t.authorizationNote && <dd className="mt-1 text-xs text-muted">{t.authorizationNote}</dd>}
            </div>
            {t.description && (
              <div>
                <dt className="label">Description</dt>
                <dd className="whitespace-pre-wrap text-muted">{t.description}</dd>
              </div>
            )}
            <div>
              <dt className="label">Created</dt>
              <dd>{formatDate(t.createdAt)}</dd>
            </div>
            <div>
              <dt className="label">Last scan</dt>
              <dd>{t.lastScanAt ? formatDate(t.lastScanAt) : 'Never'}</dd>
            </div>
            <div>
              <dt className="label">Open findings</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {SEVERITIES.filter((s) => t.openFindingsBySeverity?.[s]).map((s) => (
                  <Link key={s} href={`/findings?targetId=${id}&severity=${s}`} className="inline-flex items-center gap-1">
                    <SeverityBadge severity={s} />
                    <span className="text-xs tabular-nums">{t.openFindingsBySeverity?.[s]}</span>
                  </Link>
                ))}
                {!SEVERITIES.some((s) => t.openFindingsBySeverity?.[s]) && <span className="text-muted">None</span>}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
            <button type="button" className="btn-secondary" onClick={() => run(() => api(`/targets/${id}`, { method: 'PATCH', body: { enabled: !t.enabled } }))}>
              {t.enabled ? 'Disable' : 'Enable'}
            </button>
            <ConfirmButton
              label="Delete"
              confirmLabel="Delete target and its history"
              onConfirm={() =>
                run(async () => {
                  await api(`/targets/${id}`, { method: 'DELETE' });
                  router.push('/targets');
                })
              }
            />
          </div>
        </section>

        <section className="panel lg:col-span-2" aria-labelledby="target-scans">
          <h2 id="target-scans" className="px-4 pt-4 pb-2 text-sm font-semibold">
            Scans
          </h2>
          {scans.loading ? (
            <Loading />
          ) : scans.error ? (
            <div className="p-4">
              <ErrorState error={scans.error} onRetry={scans.reload} />
            </div>
          ) : scans.data?.items.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted">{t.authorizationConfirmedAt ? 'No scans yet. Use Start scan to run the first one.' : 'Confirm authorization to enable scanning.'}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Queued</th>
                  <th>Finished</th>
                  <th className="text-right">Findings</th>
                </tr>
              </thead>
              <tbody>
                {scans.data?.items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/scans/${s.id}`} className="hover:underline">
                        <ScanStatusBadge status={s.status} />
                      </Link>
                    </td>
                    <td className="text-muted">{timeAgo(s.queuedAt)}</td>
                    <td className="text-muted">{formatDate(s.finishedAt)}</td>
                    <td className="text-right tabular-nums">{s.findingCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

function AuthorizeCard({ onAuthorize }: { onAuthorize: (note: string) => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="mb-6 rounded-lg border border-warn/40 bg-warn/5 p-4" aria-labelledby="authorize-heading">
      <h2 id="authorize-heading" className="text-sm font-semibold text-warn">
        Authorization required before scanning
      </h2>
      <label className="mt-3 flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>I own this application or have explicit written permission from its owner to run security tests against it.</span>
      </label>
      <div className="mt-3 max-w-md">
        <Field label="Permission details (optional)" htmlFor="auth-note">
          <input id="auth-note" className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <button
        type="button"
        className="btn-primary mt-3"
        disabled={!checked || busy}
        onClick={async () => {
          setBusy(true);
          await onAuthorize(note);
          setBusy(false);
        }}
      >
        Confirm authorization
      </button>
    </section>
  );
}
