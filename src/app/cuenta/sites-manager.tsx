'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { csrfMutation, getSites } from '../../lib/auth-api';
import AnalysisPanel from './analysis-panel';

type Site = { id: string; domain: string; status: 'unverified' | 'pending' | 'verified'; verification: null | { id: string; expiresAt: string; verifiedAt: string | null; validUntil: string | null } };
type Challenge = { id: string; content: string; url: string; expiresAt: string };
const statusLabel = { unverified: 'Sin verificar', pending: 'Verificación pendiente', verified: 'Propiedad verificada' };

function isSite(value: unknown): value is Site {
  if (!value || typeof value !== 'object') return false;
  const site = value as Partial<Site>;
  return typeof site.id === 'string' && typeof site.domain === 'string' && ['unverified', 'pending', 'verified'].includes(site.status || '') && (site.verification === null || !!site.verification && typeof site.verification.id === 'string' && typeof site.verification.expiresAt === 'string');
}

export default function SitesManager() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [challenges, setChallenges] = useState<Record<string, Challenge>>({});

  const load = useCallback(async () => {
    const response = await getSites();
    if (response.status === 401) { router.replace('/login'); router.refresh(); return []; }
    if (!response.ok) throw new Error('No se pudieron cargar tus sitios.');
    const body: unknown = await response.json();
    if (!Array.isArray(body) || !body.every(isSite)) throw new Error('La respuesta de sitios no es válida.');
    return body;
  }, [router]);

  useEffect(() => { let active = true; load().then(body => { if (active) setSites(body); }).catch(() => { if (active) setError('No se pudieron cargar tus sitios. Inténtalo de nuevo.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [load]);

  async function mutate(path: string, body?: object) {
    const response = await csrfMutation(path, body);
    if (response.status === 401) { router.replace('/login'); router.refresh(); throw new Error('La sesión caducó. Inicia sesión de nuevo.'); }
    if (!response.ok) {
      const messages: Record<number, string> = { 400: 'Revisa el dominio o el contenido exacto del archivo.', 403: 'La protección CSRF rechazó la solicitud. Reintenta o vuelve a iniciar sesión.', 404: 'Sitio no encontrado.', 409: 'El dominio ya está registrado o el desafío caducó, fue renovado o ya se utilizó.', 429: 'Demasiados intentos. Espera un minuto.', 502: 'No se pudo leer el archivo. Comprueba DNS público, HTTPS y la ruta, sin redirecciones.', 503: 'Hay verificaciones en curso. Reintenta más tarde.' };
      throw new Error(messages[response.status] || 'El servicio no está disponible. Inténtalo más tarde.');
    }
    return response;
  }

  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await work(); setSites(await load()); } catch (cause) { setError(cause instanceof Error && !/fetch|network/i.test(cause.message) ? cause.message : 'No se pudo conectar con el servicio.'); }
    finally { setBusy(false); }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = domain.trim();
    if (!value || /[\s/:@\\?#%\[\]]/.test(value) || !value.includes('.')) { setError('Introduce un dominio, por ejemplo mi-sitio.com, sin URL ni ruta.'); return; }
    await action(async () => { await mutate('/sites', { domain: value }); setDomain(''); setMessage('Sitio registrado. Genera el archivo para verificar su propiedad.'); });
  }

  async function issue(site: Site) {
    await action(async () => {
      const response = await mutate(`/sites/${encodeURIComponent(site.id)}/verification-challenges`);
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object') throw new Error('Respuesta de desafío inválida.');
      const challenge = body as Challenge;
      if (typeof challenge.id !== 'string' || typeof challenge.content !== 'string' || typeof challenge.url !== 'string' || typeof challenge.expiresAt !== 'string') throw new Error('Respuesta de desafío inválida.');
      setChallenges(previous => ({ ...previous, [site.id]: challenge }));
      setMessage('Nuevo código generado. Reemplaza el archivo anterior; los desafíos anteriores ya no son válidos.');
    });
  }

  async function check(site: Site, challengeId: string) {
    await action(async () => { await mutate(`/sites/${encodeURIComponent(site.id)}/verification-challenges/${encodeURIComponent(challengeId)}/check`); setChallenges(previous => { const next = { ...previous }; delete next[site.id]; return next; }); setMessage('Propiedad del dominio verificada durante 30 días. Ya puedes solicitar un análisis manual.'); });
  }

  return <section aria-labelledby="sites-heading" className="sites-section">
    <h2 id="sites-heading">Tus sitios</h2>
    <p className="description">Registra únicamente dominios que administras. Cada subdominio se verifica por separado.</p>
    <form onSubmit={register} aria-busy={busy} noValidate>
      <div className="field"><label htmlFor="site-domain">Dominio</label><input id="site-domain" name="domain" value={domain} onChange={event => setDomain(event.target.value)} required maxLength={1024} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="domain-help sites-error" /><p id="domain-help" className="help">Ejemplo: mi-sitio.com. Sin https://, puertos ni rutas. No se aceptan direcciones IP ni dominios locales.</p></div>
      <button className="submit" disabled={busy || loading}>{busy ? 'Procesando…' : 'Registrar sitio'}</button>
    </form>
    <div id="sites-error" role="alert">{error && <p className="form-error">{error}</p>}</div>
    <div role="status" aria-live="polite">{message && <p className="success">{message}</p>}{loading && <p>Cargando sitios…</p>}</div>
    <button type="button" className="text-button" disabled={busy || loading} onClick={() => void action(async () => {})}>Actualizar lista</button>
    {!loading && sites.length === 0 && <p>Todavía no tienes sitios registrados.</p>}
    <ul className="sites-list">{sites.map(site => {
      const challenge = challenges[site.id];
      const pending = site.status === 'pending' ? site.verification?.id : undefined;
      return <li key={site.id} className="site-card"><h3>{site.domain}</h3><p><strong>{statusLabel[site.status]}</strong></p>
        {site.status === 'verified' && site.verification?.validUntil && <p>Válida hasta {new Date(site.verification.validUntil).toLocaleString('es-MX')}.</p>}
        <button className="text-button" disabled={busy} onClick={() => void issue(site)}>{site.verification ? 'Renovar desafío' : 'Generar desafío'} para {site.domain}</button>
        {challenge && <div className="verification-instructions"><h4>Publica el archivo de verificación</h4><ol><li>Crea un archivo de texto con este contenido exacto:<pre>{challenge.content}</pre></li><li>Publícalo en <code>{challenge.url}</code>. Debe responder directamente por HTTPS con certificado válido, sin redirecciones.</li><li>Solicita la comprobación antes de {new Date(challenge.expiresAt).toLocaleString('es-MX')}. El código caduca en 30 minutos.</li></ol><p className="help">El código se muestra solo en esta página y no se guarda en el navegador. Si lo pierdes, genera otro. Renovar invalida la verificación anterior.</p></div>}
        {(challenge || pending) && <button className="submit" disabled={busy} onClick={() => void check(site, challenge?.id || pending!)}>Comprobar archivo de {site.domain}</button>}
        <AnalysisPanel siteId={site.id} verified={site.status === 'verified'} />
      </li>;
    })}</ul>
  </section>;
}
