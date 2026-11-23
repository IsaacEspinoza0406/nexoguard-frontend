'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './ui';

export type NoticeKind = 'success' | 'error' | 'info' | 'progress';
type Notice = { id: string; kind: NoticeKind; message: string };
type Notifications = { notify: (id: string, kind: NoticeKind, message: string) => void; dismiss: (id: string) => void };
// Components remain usable in isolation; the app installs the provider once in its root layout.
const Context = createContext<Notifications>({ notify: () => {}, dismiss: () => {} });
const titles: Record<NoticeKind, string> = { success: 'Completado', error: 'Requiere atención', info: 'Información', progress: 'En curso' };
const icons: Record<NoticeKind, IconName> = { success: 'check', error: 'warning', info: 'info', progress: 'clock' };

function Toast({ notice, dismiss }: { notice: Notice; dismiss: (id: string) => void }) {
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false);
  const { id, kind, message } = notice;
  useEffect(() => {
    // Errors/progress stay until explicitly dismissed or replaced by a confirmed result.
    if (hovered || focused || kind === 'error' || kind === 'progress') return;
    const timer = setTimeout(() => dismiss(id), 8000);
    return () => clearTimeout(timer);
  }, [id, kind, message, hovered, focused, dismiss]);
  return <div className={`toast toast-${kind}`} data-notice-id={id}
    onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <Icon name={icons[kind]} /><div className="toast-copy" role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'error' ? 'assertive' : 'polite'} aria-atomic="true"><strong>{titles[kind]}</strong><p>{message}</p></div>
    <button className="toast-close" type="button" onClick={() => dismiss(id)} aria-label={`Cerrar notificación: ${titles[kind]}`}><span aria-hidden="true">×</span></button>
  </div>;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const dismiss = useCallback((id: string) => setNotices(items => items.filter(item => item.id !== id)), []);
  const notify = useCallback((id: string, kind: NoticeKind, message: string) => {
    setNotices(items => {
      const previous = items.find(item => item.id === id);
      if (previous?.kind === kind && previous.message === message) return items;
      const next = { id, kind, message };
      return previous ? items.map(item => item.id === id ? next : item) : [...items.slice(-3), next];
    });
  }, []);
  return <Context.Provider value={{ notify, dismiss }}>{children}<aside className="toast-region" aria-label="Notificaciones">{notices.map(notice => <Toast key={notice.id} notice={notice} dismiss={dismiss} />)}</aside></Context.Provider>;
}

export function useNotifications() { return useContext(Context); }
