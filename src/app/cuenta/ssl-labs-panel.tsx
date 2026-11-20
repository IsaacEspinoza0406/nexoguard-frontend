'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { csrfMutation, getSslLabs } from '../../lib/auth-api';

type Report = { provider: string; phase: string; reason: string | null; requestedAt: string; fetchedAt: string | null; testTime: string | null; startTime: string | null; engineVersion: string | null; criteriaVersion: string | null; endpoints: { endpoint: number; status: string; grade: string | null; hasWarnings: boolean }[] };
type Job = { id: string; estado: string; creadoEn: string; motivoFallo: string | null; disponibleEn: string; report: Report | null };
const phases: Record<string, string> = { PENDING: 'Pendiente de consulta', WAITING: 'En espera del proveedor', DNS: 'Resolviendo dominio en SSL Labs', IN_PROGRESS: 'En evaluación en SSL Labs', READY: 'Informe disponible', ERROR: 'Consulta fallida' };
export default function SslLabsPanel({ siteId, verified }: { siteId: string; verified: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [loaded, setLoaded] = useState(false), [configured, setConfigured] = useState(false), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]), [error, setError] = useState(''), [reason, setReason] = useState(''), [refresh, setRefresh] = useState(0), [message, setMessage] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const active = jobs.some(j => ['PENDIENTE', 'EN_EJECUCION'].includes(j.estado));
  useEffect(() => {
    if (!open) return;
    let live = true;
    let failedStatus: number | undefined;
    getSslLabs(siteId).then(async response => {
      if (!live) return;
      if (response.status === 401) { router.replace('/login'); return; }
      if (!response.ok) { failedStatus = response.status; throw new Error(); }
      const b = await response.json();
      if (!b || typeof b.configured !== 'boolean' || !Array.isArray(b.reports) || !b.reports.every((j: Job) => j && typeof j.id === 'string' && typeof j.estado === 'string' && (j.report === null || !!j.report && Array.isArray(j.report.endpoints)))) throw new Error();
      if (live) { setJobs(b.reports); setConfigured(b.configured); setReason(typeof b.reason === 'string' ? b.reason : ''); setLoaded(true); setRefreshError(''); }
    }).catch(() => { if (live) setRefreshError(`No se pudo actualizar el estado guardado de SSL Labs desde NexoGuard${failedStatus ? ` (HTTP ${failedStatus})` : ''}. Este aviso no indica que la evaluación haya fallado. Se conserva cualquier informe mostrado y los resultados propios siguen disponibles.`); });
    return () => { live = false; };
  }, [open, siteId, refresh, router]);
  useEffect(() => { if (!open || !active) return; const timer = setInterval(() => setRefresh(v => v + 1), 15000); return () => clearInterval(timer); }, [open, active]);
  async function start() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await csrfMutation(`/sites/${encodeURIComponent(siteId)}/ssl-labs`, { consent });
      if (response.status === 401) { router.replace('/login'); return; }
      if (response.status !== 202) {
        const errors: Record<number, string> = { 400: 'Autoriza la evaluación externa antes de continuar.', 403: 'Solicitud rechazada por origen o CSRF.', 404: 'Sitio no encontrado.', 409: 'Verifica la propiedad vigente o espera a que termine la consulta activa.', 429: 'Demasiadas solicitudes. Espera antes de reintentar.', 503: 'SSL Labs necesita habilitación y un correo institucional registrado en el backend.' };
        setError(errors[response.status] || 'No se pudo solicitar SSL Labs. Los resultados propios siguen disponibles.'); return;
      }
      setMessage('Consulta externa solicitada. Puede usar caché de hasta 24 horas; consulta su fecha de evaluación.'); setConsent(false); setRefresh(v => v + 1);
    } catch { setError('No se pudo conectar. Puedes seguir consultando los resultados propios.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="SSL Labs complementario">
    <button className="text-button" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Ocultar SSL Labs' : 'SSL Labs complementario'}</button>
    {open && <div><h4>SSL Labs · evaluación externa complementaria</h4>
      <p>Qualys recibirá el dominio y realizará las conexiones desde sus servidores. No se envían tus cookies, sesión ni contraseña. No se publica el informe en su tablón público; esto no significa que el dominio sea confidencial para Qualys.</p>
      <p>Se solicitan informes con caché máxima de 24 horas. Si no hay informe, el proveedor puede iniciar una evaluación. Sus notas no son puntuaciones propias de NexoGuard ni sustituyen sus comprobaciones.</p>
      {error && <p role="alert">{error}</p>}{refreshError && <p role="alert">{refreshError}</p>}<p role="status">{message}</p>
      {!loaded && !refreshError && <p>Cargando estado de SSL Labs…</p>}{loaded && !configured && <p>{reason}</p>}
      {!verified && <p>Verifica la revisión actual antes de autorizar una evaluación externa.</p>}
      <label className="show-password"><input type="checkbox" checked={consent} disabled={!configured || !verified || active || busy} onChange={e => setConsent(e.target.checked)} />Autorizo a Qualys SSL Labs a evaluar este dominio.</label>
      <button className="text-button" disabled={!loaded || !configured || !verified || !consent || active || busy} onClick={() => void start()}>{busy ? 'Solicitando SSL Labs…' : 'Solicitar SSL Labs'}</button>
      <button className="text-button" disabled={busy} onClick={() => setRefresh(v => v + 1)}>Actualizar SSL Labs</button>
      <p>Actualizar recupera los informes guardados en NexoGuard; no solicita otra evaluación externa.</p>
      {loaded && !jobs.length && <p>No hay consultas SSL Labs registradas.</p>}
      <ul className="analysis-results">{jobs.map(job => <li key={job.id}>
        <h5>{job.estado === 'FALLIDO' ? 'Consulta fallida' : phases[job.report?.phase || ''] || job.estado}</h5>
        <p>Procedencia: Qualys SSL Labs API v4</p><p>Solicitado: {new Date(job.creadoEn).toLocaleString('es-MX')}</p>
        {job.report?.fetchedAt && <p>Consultado al proveedor: {new Date(job.report.fetchedAt).toLocaleString('es-MX')}</p>}
        {job.report?.testTime && <p>Fecha de evaluación del proveedor: {new Date(job.report.testTime).toLocaleString('es-MX')}</p>}
        {(job.motivoFallo || job.report?.reason) && <p>{job.motivoFallo || job.report?.reason}</p>}
        {['PENDIENTE', 'EN_EJECUCION'].includes(job.estado) && <p>Próxima consulta no antes de {new Date(job.disponibleEn).toLocaleString('es-MX')}. La evaluación puede tardar varios minutos; los resultados propios no dependen de ella.</p>}
        {job.report && <><p>Motor del proveedor: {job.report.engineVersion || 'No informado'} · Criterios: {job.report.criteriaVersion || 'No informados'}</p><ul>{job.report.endpoints.map(endpoint => <li key={endpoint.endpoint}>Endpoint {endpoint.endpoint}: {endpoint.status === 'READY' ? `Nota del proveedor: ${endpoint.grade ?? 'No informada'}` : endpoint.status === 'ERROR' ? 'No pudo evaluarse' : 'Pendiente'}{endpoint.hasWarnings ? ' · Advertencias del proveedor' : ''}</li>)}</ul></>}
      </li>)}</ul>
    </div>}
  </section>;
}
