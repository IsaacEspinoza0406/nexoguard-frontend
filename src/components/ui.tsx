import type { ReactNode } from 'react';

export type IconName = 'shield' | 'globe' | 'grid' | 'plus' | 'arrow' | 'check' | 'clock' | 'info' | 'warning' | 'lock' | 'activity' | 'logout' | 'chevron';
const paths: Record<IconName, ReactNode> = {
  shield: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.2" /></>,
  warning: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3v.2" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
  activity: <path d="M2 12h4l3-8 6 16 3-8h4" />,
  logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5m-5-5h13" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
};
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function Brand() {
  return <span className="brand"><span className="brand-mark"><Icon name="shield" /></span><span>Nexo<span className="brand-light">Guard</span></span></span>;
}
export function StatusBadge({ status, children }: { status: string; children: ReactNode }) {
  const good = ['verified', 'APROBADO', 'COMPLETADO', 'MEJORO'].includes(status);
  const warning = ['HALLAZGO', 'FALLIDO', 'EMPEORO'].includes(status);
  const pending = ['pending', 'PENDIENTE', 'EN_EJECUCION'].includes(status);
  return <span className={`status-badge ${good ? 'status-good' : warning ? 'status-warning' : pending ? 'status-pending' : 'status-neutral'}`}><Icon name={good ? 'check' : warning ? 'warning' : pending ? 'clock' : 'info'} />{children}</span>;
}
