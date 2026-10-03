import Link from 'next/link';
import type { ApiError } from '@/lib/api';

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 px-4 py-10 text-sm text-muted">
      <span className="size-3 animate-spin rounded-full border-2 border-line-strong border-t-accent" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="panel border-danger/40 px-4 py-4 text-sm">
      <p className="font-medium text-danger">Something went wrong</p>
      <p className="mt-1 text-muted">{error.message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary mt-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-10">
      <p className="font-medium">{title}</p>
      <p className="max-w-prose text-sm text-muted">{body}</p>
      {action && (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}
