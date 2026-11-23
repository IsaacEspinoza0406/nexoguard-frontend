import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { NotificationsProvider } from '../components/notifications';

export const metadata: Metadata = { title: 'NexoGuard' };
// Nonce CSP requires per-request rendering, never a cached/static nonce.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body><NotificationsProvider>{children}</NotificationsProvider></body>
    </html>
  );
}
