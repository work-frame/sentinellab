'use client';

import { useState } from 'react';
import type { Target } from '@/lib/types';
import { Field, FormError } from './ui';

export interface TargetFormValues {
  name: string;
  description: string;
  baseUrl: string;
  environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  authorizationConfirmed: boolean;
  authorizationNote: string;
}

export function TargetForm({
  initial,
  submitLabel,
  onSubmit,
  showAuthorization = true,
}: {
  initial?: Partial<Target>;
  submitLabel: string;
  onSubmit: (values: TargetFormValues) => Promise<void>;
  showAuthorization?: boolean;
}) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const lockedUrl = initial?.isDemo;

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit({
        name: String(f.get('name') ?? ''),
        description: String(f.get('description') ?? ''),
        baseUrl: String(f.get('baseUrl') ?? initial?.baseUrl ?? ''),
        environment: (f.get('environment') ?? initial?.environment ?? 'DEVELOPMENT') as TargetFormValues['environment'],
        authorizationConfirmed: f.get('authorizationConfirmed') === 'on',
        authorizationNote: String(f.get('authorizationNote') ?? ''),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <FormError message={error} />
      <Field label="Name" htmlFor="name">
        <input id="name" name="name" className="input" required maxLength={100} defaultValue={initial?.name} placeholder="Staging storefront" />
      </Field>
      <Field label="Base URL" htmlFor="baseUrl" hint="http or https. SentinelLab refuses private, loopback and cloud metadata addresses; local targets must come from the Demo Lab.">
        <input id="baseUrl" name="baseUrl" type="url" className="input mono" required maxLength={2048} defaultValue={initial?.baseUrl} placeholder="https://staging.example.com/" disabled={lockedUrl} />
      </Field>
      {!lockedUrl && (
        <Field label="Environment" htmlFor="environment">
          <select id="environment" name="environment" className="input" defaultValue={initial?.environment ?? 'DEVELOPMENT'}>
            <option value="DEVELOPMENT">Development</option>
            <option value="STAGING">Staging</option>
            <option value="PRODUCTION">Production</option>
          </select>
        </Field>
      )}
      <Field label="Description" htmlFor="description">
        <textarea id="description" name="description" className="input min-h-20" maxLength={1000} defaultValue={initial?.description ?? ''} />
      </Field>
      {showAuthorization && (
        <fieldset className="rounded-md border border-warn/40 bg-warn/5 p-4">
          <legend className="px-1 text-xs font-semibold tracking-wide text-warn uppercase">Authorization</legend>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="authorizationConfirmed" className="mt-1 size-4 accent-[var(--accent)]" />
            <span>
              I own this application or have explicit written permission from its owner to run security tests against it. I understand that scanning systems without permission may be illegal.
            </span>
          </label>
          <div className="mt-3">
            <Field label="Permission details (optional)" htmlFor="authorizationNote" hint="Who approved it, ticket number, scope limits.">
              <input id="authorizationNote" name="authorizationNote" className="input" maxLength={500} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">You can save the target without confirming, but you cannot scan it until you do.</p>
        </fieldset>
      )}
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
