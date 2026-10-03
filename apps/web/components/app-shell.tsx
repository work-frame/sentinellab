'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { Logo } from './logo';
import { Loading } from './states';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/targets', label: 'Targets' },
  { href: '/scans', label: 'Scans' },
  { href: '/findings', label: 'Findings' },
  { href: '/reports', label: 'Reports' },
  { href: '/demo-lab', label: 'Demo Lab' },
  { href: '/settings', label: 'Settings' },
];

const UserContext = createContext<User | null>(null);
export const useUser = () => useContext(UserContext);

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user, error, loading } = useApi<User>('/auth/me');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (error?.status === 401) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [error, pathname, router]);

  if (loading || error?.status === 401) return <Loading label="Checking your session" />;
  if (error || !user)
    return (
      <div className="mx-auto max-w-md p-8">
        <p className="font-medium text-danger">Could not load your session.</p>
        <p className="mt-1 text-sm text-muted">{error?.message}</p>
      </div>
    );

  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  return (
    <UserContext.Provider value={user}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1 focus:text-accent-ink">
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-60 flex-col border-r border-line bg-panel md:static md:flex ${menuOpen ? 'flex' : 'hidden'}`}
          aria-label="Main navigation"
        >
          <div className="flex h-14 items-center border-b border-line px-4">
            <Link href="/">
              <Logo />
            </Link>
          </div>
          <nav className="flex-1 space-y-0.5 p-2">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center rounded-md px-3 py-2 text-sm ${active ? 'bg-panel-2 font-medium text-text shadow-[inset_2px_0_0_var(--accent)]' : 'text-muted hover:bg-panel-2 hover:text-text'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-line p-3 text-xs">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-muted">{user.email}</p>
            <button type="button" onClick={signOut} className="mt-2 text-muted underline-offset-2 hover:text-text hover:underline">
              Sign out
            </button>
          </div>
        </aside>
        {menuOpen && <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMenuOpen(false)} />}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-line px-4 md:hidden">
            <Logo />
            <button type="button" className="btn-secondary" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              Menu
            </button>
          </header>
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
          <footer className="border-t border-line px-4 py-3 text-xs text-faint md:px-8">
            Scan only systems you own or have written permission to test. Results are automated checks, not proof of security.
          </footer>
        </div>
      </div>
    </UserContext.Provider>
  );
}
