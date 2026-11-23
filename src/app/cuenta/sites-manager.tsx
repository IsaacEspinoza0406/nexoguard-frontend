'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { csrfMutation, getSites } from '../../lib/auth-api';
import AnalysisPanel from './analysis-panel';
import { Icon, StatusBadge } from '../../components/ui';
import { useNotifications } from '../../components/notifications';

type Site = { id: string; domain: string; status: 'unverified' | 'pending' | 'verified'; verification: null | { id: string; expiresAt: string; verifiedAt: string | null; validUntil: string | null } };
class PublicActionError extends Error {}
type Feedback = { kind: 'success' | 'error' | 'info'; text: string };
type ActionNotice = { id: string; pending: string; success: string; siteId?: string };
type Challenge = { id: string; content: string; url: string; expiresAt: string };
const statusLabel = { unverified: 'Sin verificar', pending: 'Verificación pendiente', verified: 'Propiedad verificada' };

function isSite(value: unknown): value is Site {
  if (!value || typeof value !== 'object') return false;
  const site = value as Partial<Site>;
  return typeof site.id === 'string' && typeof site.domain === 'string' && ['unverified', 'pending', 'verified'].includes(site.status || '') && (site.verification === null || !!site.verification && typeof site.verification.id === 'string' && typeof site.verification.expiresAt === 'string');
}

export default function SitesManager() {
  const router = useRouter();
  const { notify } = useNotifications();
  const inFlight = useRef(false);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [sites, setSites] = useState<Site[]>([]);
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Record<string, Challenge>>({});

  const load = useCallback(async () => {
    const response = await getSites();
    if (response.status === 401) { router.replace('/login'); router.refresh(); return []; }
    if (!response.ok) throw new PublicActionError('No se pudieron cargar tus sitios.');
    const body: unknown = await response.json();
    if (!Array.isArray(body) || !body.every(isSite)) throw new PublicActionError('No se pudieron actualizar los sitios. Inténtalo de nuevo.');
    return body;
  }, [router]);

  useEffect(() => { let active = true; load().then(body => { if (active) setSites(body); }).catch(() => { if (active) setError('No se pudieron cargar tus sitios. Inténtalo de nuevo.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [load]);

  async function mutate(path: string, body?: object) {
    const response = await csrfMutation(path, body);
    if (response.status === 401) { router.replace('/login'); router.refresh(); throw new PublicActionError('La sesión caducó. Inicia sesión de nuevo.'); }
    if (!response.ok) {
      const messages: Record<number, string> = { 400: 'Revisa el dominio o el contenido exacto del archivo.', 403: 'La protección CSRF rechazó la solicitud. Reintenta o vuelve a iniciar sesión.', 404: 'Sitio no encontrado.', 409: 'El dominio ya está registrado o el desafío caducó, fue renovado o ya se utilizó.', 429: 'Demasiados intentos. Espera un minuto.', 502: 'No se pudo leer el archivo. Comprueba DNS público, HTTPS y la ruta, sin redirecciones.', 503: 'Hay verificaciones en curso. Reintenta más tarde.' };
      throw new PublicActionError(messages[response.status] || 'El servicio no está disponible. Inténtalo más tarde.');
    }
    return response;
  }

  function placeFeedback(notice: ActionNotice, kind: Feedback['kind'], text: string) {
    if (notice.siteId) setFeedback(previous => ({ ...previous, [notice.siteId!]: { kind, text } }));
    else if (kind === 'error') setError(text);
    else setMessage(text);
  }
  async function action(work: () => Promise<void>, notice?: ActionNotice) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    if (notice?.siteId) setFeedback(previous => { const next = { ...previous }; delete next[notice.siteId!]; return next; });
    if (notice) notify(notice.id, 'progress', notice.pending);
    try {
      await work();
      if (notice) { placeFeedback(notice, 'success', notice.success); notify(notice.id, 'success', notice.success); }
      try { setSites(await load()); }
      catch {
        const text = notice ? 'La acción fue confirmada, pero no se pudo actualizar la lista. Pulsa Actualizar lista; no repitas la operación.' : 'No se pudieron cargar tus sitios. Inténtalo de nuevo.';
        if (notice) { placeFeedback(notice, 'info', text); notify(notice.id, 'info', text); } else setError(text);
      }
    } catch (cause) {
      const text = cause instanceof PublicActionError ? cause.message : 'No se pudo completar la solicitud. Comprueba tu conexión e inténtalo de nuevo.';
      if (notice) { placeFeedback(notice, 'error', text); notify(notice.id, 'error', text); } else setError(text);
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = domain.trim();
    if (!value || /[\s/:@\\?#%\[\]]/.test(value) || !value.includes('.')) { setError('Introduce un dominio, por ejemplo mi-sitio.com, sin URL ni ruta.'); document.getElementById('site-domain')?.focus(); return; }
    await action(async () => { await mutate('/sites', { domain: value }); setDomain(''); }, { id: 'site.register', pending: 'Registrando el dominio…', success: 'Sitio registrado. Genera el archivo para verificar su propiedad.' });
  }

  async function issue(site: Site) {
    await action(async () => {
      const response = await mutate(`/sites/${encodeURIComponent(site.id)}/verification-challenges`);
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object') throw new PublicActionError('No se pudo interpretar el desafío. Actualiza la lista antes de reintentar.');
      const challenge = body as Challenge;
      if (typeof challenge.id !== 'string' || typeof challenge.content !== 'string' || typeof challenge.url !== 'string' || typeof challenge.expiresAt !== 'string') throw new PublicActionError('No se pudo interpretar el desafío. Actualiza la lista antes de reintentar.');
      setChallenges(previous => ({ ...previous, [site.id]: challenge }));
    }, { id: `site.${site.id}.verification`, siteId: site.id, pending: 'Generando el archivo de propiedad…', success: 'Nuevo código generado. Reemplaza el archivo anterior; los desafíos anteriores ya no son válidos.' });
  }

  async function check(site: Site, challengeId: string) {
    await action(async () => {
      await mutate(`/sites/${encodeURIComponent(site.id)}/verification-challenges/${encodeURIComponent(challengeId)}/check`);
      setChallenges(previous => { const next = { ...previous }; delete next[site.id]; return next; });
    }, { id: `site.${site.id}.verification`, siteId: site.id, pending: 'Comprobando el archivo publicado por HTTPS…', success: 'Propiedad del dominio verificada durante 30 días. Ya puedes solicitar un análisis manual.' });
  }

  function downloadChallenge(siteId: string, challenge: Challenge) {
    try {
      const url = URL.createObjectURL(new Blob([challenge.content + '\n'], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'nexoguard-verification.txt'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('ownership.file', 'info', 'Archivo preparado. Publícalo en la ruta indicada antes de comprobarlo.');
    } catch {
      const text = 'No se pudo descargar el archivo. Copia el contenido exacto desde el panel.'; setFeedback(previous => ({ ...previous, [siteId]: { kind: 'error', text } })); notify('ownership.file', 'error', text);
    }
  }

  return <section aria-labelledby="sites-heading" className="sites-section">
    <div className="workspace-heading"><h2 id="sites-heading">Tus sitios</h2><button type="button" className="text-button" disabled={busy || loading} onClick={() => void action(async () => {})}><Icon name="activity" />Actualizar lista</button></div>
    <div className="workspace-overview"><div className="overview-copy"><Icon name="shield" /><h3>Primero el control. Después, la evidencia.</h3><p>Registra únicamente dominios que administras. Cada subdominio se verifica por separado.</p>{!loading && <div className="site-counts"><div><strong>{sites.length}</strong><span>Sitios registrados</span></div><div><strong>{sites.filter(site => site.status === 'verified').length}</strong><span>Con propiedad vigente</span></div></div>}</div>
    <section className="add-site-card" id="add-site" aria-labelledby="add-site-title"><h3 id="add-site-title">Agregar un sitio</h3><form onSubmit={register} aria-busy={busy} noValidate>
      <div className="field"><label htmlFor="site-domain">Dominio</label><input id="site-domain" name="domain" value={domain} onChange={event => setDomain(event.target.value)} required maxLength={1024} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="mi-sitio.com" aria-describedby="domain-help sites-error" /><p id="domain-help" className="help">Ejemplo: mi-sitio.com. Sin https://, puertos ni rutas. No se aceptan direcciones IP ni dominios locales.</p></div>
      <button className="submit" disabled={busy || loading}><Icon name="plus" />{busy ? 'Procesando…' : 'Registrar sitio'}</button>
    </form><div id="sites-error" role="alert">{error && <p className="form-error">{error}</p>}</div><div role="status" aria-live="polite">{message && <p className="success">{message}</p>}</div></section></div>
    {loading && <p className="loading-state" role="status"><Icon name="clock" />Cargando sitios…</p>}
    {!loading && sites.length === 0 && <div className="empty-state"><Icon name="globe" /><strong>Tu espacio está listo.</strong><p>Todavía no tienes sitios registrados.</p><p>Agrega tu primer dominio y verifica su propiedad para comenzar.</p></div>}
    <ul className="sites-list">{sites.map((site, index) => {
      const challenge = challenges[site.id];
      const pending = site.status === 'pending' ? site.verification?.id : undefined;
      const isSelected = selected ? selected === site.id : index === 0;
      return <li key={site.id} className="site-card"><header className="site-header"><div className="site-identity"><span className="domain-symbol"><Icon name="globe" /></span><div><h3>{site.domain}</h3><p className="help">Dominio propio · revisión de la página principal</p></div></div><StatusBadge status={site.status}>{statusLabel[site.status]}</StatusBadge>{sites.length > 1 && <button className="text-button" aria-expanded={isSelected} aria-controls={isSelected ? `workspace-${site.id}` : undefined} disabled={busy} onClick={() => setSelected(site.id)}>Gestionar sitio</button>}</header>
        {isSelected && <div className="site-body" id={`workspace-${site.id}`}><div className="site-actions"><button className="text-button" disabled={busy} onClick={() => void issue(site)}><Icon name="shield" />{site.verification ? 'Renovar desafío' : 'Generar desafío'} para {site.domain}</button>
        {site.status === 'verified' && site.verification?.validUntil && <p className="help">Válida hasta {new Date(site.verification.validUntil).toLocaleString('es-MX')}.</p>}
        {site.status !== 'verified' && <p className="help">Siguiente paso: {challenge ? 'publica el archivo descargado y después compruébalo.' : pending ? 'comprueba el archivo publicado, o renueva el código si ya caducó.' : 'genera el archivo para acreditar que administras este dominio.'}</p>}</div>
        {feedback[site.id] && <p className={feedback[site.id].kind === 'error' ? 'form-error' : feedback[site.id].kind === 'success' ? 'success' : 'inline-info'} role={feedback[site.id].kind === 'error' ? 'alert' : 'status'}>{feedback[site.id].text}</p>}
        {(site.status !== 'verified' || challenge) && <ol className="verification-steps" aria-label="Pasos para verificar propiedad"><li><span>1</span><div><strong>Generar archivo</strong><p>{challenge ? 'Código listo en este panel.' : 'Obtén un código vinculado a este dominio.'}</p></div></li><li><span>2</span><div><strong>Publicar</strong><p>Sube el archivo a .well-known en tu sitio.</p></div></li><li><span>3</span><div><strong>Comprobar</strong><p>Confirma su publicación antes de que caduque.</p></div></li></ol>}
        {challenge && <div className="verification-instructions"><h4>Publica el archivo de verificación</h4><button className="text-button" disabled={busy} onClick={() => downloadChallenge(site.id, challenge)}>Descargar archivo de verificación</button><ol><li>Crea un archivo de texto con este contenido exacto:<pre>{challenge.content}</pre></li><li>Publícalo en <code>{challenge.url}</code>. Debe responder directamente por HTTPS con certificado válido, sin redirecciones.</li><li>Solicita la comprobación antes de {new Date(challenge.expiresAt).toLocaleString('es-MX')}. El código caduca en 30 minutos.</li></ol><p className="help">El código se muestra solo en esta página y no se guarda en el navegador. Si lo pierdes, genera otro. Renovar invalida la verificación anterior.</p></div>}
        {(challenge || pending) && <button className="submit" disabled={busy} onClick={() => void check(site, challenge?.id || pending!)}><Icon name="check" />Comprobar archivo de {site.domain}</button>}
        <AnalysisPanel siteId={site.id} verified={site.status === 'verified'} />
        </div>}
      </li>;
    })}</ul>
  </section>;
}
