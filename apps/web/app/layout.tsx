import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'SentinelLab', template: '%s · SentinelLab' },
  description: 'Authorized security testing for applications you own.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
