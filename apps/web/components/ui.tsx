'use client';

import Link from 'next/link';
import { useState } from 'react';

export function PageHeader({ title, subtitle, actions, crumbs }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; crumbs?: { href: string; label: string }[] }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1 text-xs text-muted">
            {crumbs.map((c, i) => (
              <span key={c.href}>
                {i > 0 && <span className="px-1.5 text-faint">/</span>}
                <Link href={c.href} className="hover:text-text">
                  {c.label}
                </Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-muted">
      <span>
        {from}–{to} of {total}
      </span>
      <span className="flex items-center gap-2">
        <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </span>
    </nav>
  );
}

/** A button that asks for a second click before running a destructive action. */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'btn-danger', disabled }: { label: string; confirmLabel: string; onConfirm: () => Promise<void> | void; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!armed)
    return (
      <button type="button" className={className} disabled={disabled} onClick={() => setArmed(true)}>
        {label}
      </button>
    );
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn-danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setArmed(false);
          }
        }}
      >
        {busy ? 'Working…' : confirmLabel}
      </button>
      <button type="button" className="btn-secondary" onClick={() => setArmed(false)} disabled={busy}>
        Keep
      </button>
    </span>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export function Stat({ label, value, tone, hint }: { label: string; value: number | string; tone?: string; hint?: string }) {
  return (
    <div className="panel px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function DemoWarning({ compact = false }: { compact?: boolean }) {
  return (
    <div role="note" className={`rounded-md border border-warn/50 bg-warn/10 font-semibold tracking-wide text-warn ${compact ? 'px-2 py-1 text-[11px]' : 'px-4 py-2.5 text-xs'}`}>
      INTENTIONALLY VULNERABLE — LOCAL SECURITY TRAINING TARGET
    </div>
  );
}
