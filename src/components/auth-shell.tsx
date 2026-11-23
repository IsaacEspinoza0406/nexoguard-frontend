'use client';

import { useRef, type ReactNode, type PointerEvent } from 'react';
import Link from 'next/link';
import { Brand, Icon } from './ui';

export default function AuthShell({ children }: { children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  function illuminate(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    panel.current?.style.setProperty('--light-x', `${Math.round(event.clientX - rect.left)}px`);
    panel.current?.style.setProperty('--light-y', `${Math.round(event.clientY - rect.top)}px`);
  }
  return <main className="auth-shell" id="main-content">
    <section className="auth-visual" ref={panel} onPointerMove={illuminate} aria-labelledby="intro-title">
      <Link href="/" className="brand-link" aria-label="NexoGuard, crear cuenta"><Brand /></Link>
      <div className="auth-story"><p className="eyebrow"><span className="signal-dot" /> VISIBILIDAD PARA DECIDIR</p>
        <h1 id="intro-title">Tu sitio. <br />La evidencia. <br /><span>El siguiente paso.</span></h1>
        <p>Entiende la configuración de seguridad de los sitios que administras. Del primer hallazgo a una decisión informada.</p>
        <div className="security-visual" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="visual-core"><Icon name="shield" /></div><span className="visual-node node-one"><Icon name="globe" /></span><span className="visual-node node-two"><Icon name="lock" /></span><span className="visual-node node-three"><Icon name="activity" /></span><span className="visual-caption">OBSERVAR → COMPRENDER → MEJORAR</span></div>
        <div className="auth-capabilities"><span><Icon name="globe" /> Sitios propios</span><span><Icon name="activity" /> Evidencia técnica</span><span><Icon name="clock" /> Seguimiento</span></div>
      </div>
      <p className="auth-disclaimer"><Icon name="info" /> Una revisión orientativa, no una garantía de ausencia de vulnerabilidades.</p>
    </section>
    <section className="auth-form-side"><div className="mobile-brand"><Brand /></div>{children}<p className="auth-platform-note"><Icon name="lock" /> Cuenta independiente de NexoGuard. No uses credenciales de Google ni de otros servicios.</p></section>
  </main>;
}
