import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo className="text-lg" />
        </div>
        <div className="panel p-6 shadow-2xl shadow-black/20">{children}</div>
        <p className="mt-4 text-center text-xs text-faint">For authorized security testing of systems you own or have permission to test.</p>
      </div>
    </div>
  );
}
