import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
      <Link href="/" className="btn-secondary mt-6">
        Back to the dashboard
      </Link>
    </div>
  );
}
