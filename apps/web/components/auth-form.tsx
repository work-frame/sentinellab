'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { safeNextPath } from '@/lib/safe-redirect';
import { Field, FormError } from './ui';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = { email: String(form.get('email')), password: String(form.get('password')) };
    if (mode === 'register') {
      body.name = String(form.get('name'));
      if (body.password !== String(form.get('confirm'))) return setError('The passwords do not match.');
    }
    setBusy(true);
    setError(undefined);
    try {
      await api(`/auth/${mode}`, { method: 'POST', body });
      router.replace(safeNextPath(params.get('next')));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
      <h1 className="text-lg font-semibold">{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
      <FormError message={error} />
      {mode === 'register' && (
        <Field label="Name" htmlFor="name">
          <input id="name" name="name" className="input" autoComplete="name" required maxLength={100} />
        </Field>
      )}
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" className="input" autoComplete="email" required maxLength={254} />
      </Field>
      <Field label="Password" htmlFor="password" hint={mode === 'register' ? 'At least 12 characters. A short sentence works well.' : undefined}>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          minLength={mode === 'register' ? 12 : 1}
          maxLength={128}
        />
      </Field>
      {mode === 'register' && (
        <Field label="Confirm password" htmlFor="confirm">
          <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required minLength={12} maxLength={128} />
        </Field>
      )}
      <button type="submit" className="btn-primary w-full py-2" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
      <p className="text-center text-sm text-muted">
        {mode === 'login' ? (
          <>
            No account?{' '}
            <Link href="/register" className="text-accent hover:underline">
              Create one
            </Link>
          </>
        ) : (
          <>
            Already registered?{' '}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
