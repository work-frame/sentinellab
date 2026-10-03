'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorState, Loading } from '@/components/states';
import { DemoWarning, FormError, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { DemoTarget, Scan, Target } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function DemoLabPage() {
  const { data, error, loading, reload } = useApi<DemoTarget[]>('/demo/targets');
  return (
    <>
      <PageHeader title="Demo Lab" subtitle="Practice on intentionally vulnerable targets that run on your own machine." />
      <div className="mb-6">
        <DemoWarning />
      </div>
      <section className="panel mb-6 p-5 text-sm">
        <h2 className="font-semibold">Start the demo targets</h2>
        <p className="mt-1 text-muted">The demo apps live in the repository under targets/ and run only through the local Docker setup, bound to 127.0.0.1:</p>
        <pre className="mono mt-3 overflow-x-auto rounded-md border border-line bg-bg p-3 text-xs">docker compose up -d vulnerable-web vulnerable-api</pre>
        <p className="mt-3 text-muted">Then add one below and start a scan. SentinelLab only allows local addresses for these exact demo hosts and ports.</p>
      </section>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data && data.length === 0 ? (
        <p className="text-sm text-muted">No demo targets are configured. Set DEMO_TARGETS for the API.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.map((d) => (
            <DemoCard key={d.key} demo={d} onChange={reload} />
          ))}
        </div>
      )}
    </>
  );
}

function DemoCard({ demo, onChange }: { demo: DemoTarget; onChange: () => Promise<void> }) {
  const router = useRouter();
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function addAndScan(scan: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      const target = demo.targetId ? { id: demo.targetId } : await api<Target>(`/demo/targets/${demo.key}`, { method: 'POST', body: { acknowledge: true } });
      if (scan) {
        const s = await api<Scan>(`/targets/${target.id}/scans`, { method: 'POST' });
        router.push(`/scans/${s.id}`);
        return;
      }
      await onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel flex flex-col p-5">
      <div className="mb-3">
        <DemoWarning compact />
      </div>
      <h2 className="font-semibold">{demo.name}</h2>
      <p className="mono mt-1 text-xs text-muted">{demo.baseUrl}</p>
      <p className="mt-2 flex-1 text-sm text-muted">{demo.description}</p>
      <div className="mt-3">
        <FormError message={error} />
      </div>
      {demo.targetId ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => addAndScan(true)}>
            {busy ? 'Queuing…' : 'Scan now'}
          </button>
          <Link href={`/targets/${demo.targetId}`} className="btn-secondary">
            View target
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 size-4" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>I understand this is an intentionally vulnerable app that I run locally, and I will not expose it to a network.</span>
          </label>
          <button type="button" className="btn-primary" disabled={!ack || busy} onClick={() => addAndScan(false)}>
            {busy ? 'Adding…' : 'Add to my targets'}
          </button>
        </div>
      )}
    </article>
  );
}
