'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { csrfMutation, getAnalyses } from '../../lib/auth-api';
import AnalysisComparison, { Guidance, Recommendation } from './analysis-comparison';
import MonitoringPanel from './monitoring-panel';
import SslLabsPanel from './ssl-labs-panel';

type Job = { id: string; estado: string; creadoEn: string; motivoFallo: string | null };
type Result = { codigoComprobacion: string; estado: string; evidencia: Record<string, unknown> | null; observadoEn: string; guidance?: Guidance | null };
type Detail = { id: string; estado: string; motivoFallo: string | null; resultados: Result[] };
const labels: Record<string, string> = { PENDIENTE: 'Pendiente', EN_EJECUCION: 'En ejecución', COMPLETADO: 'Completado', FALLIDO: 'Fallido', APROBADO: 'Comprobación aprobada', HALLAZGO: 'Hallazgo', NO_APLICABLE: 'No aplicable', NO_EVALUADO: 'No evaluado' };
const names: Record<string, string> = { HTTP_REDIRECT: 'Redirección HTTP a HTTPS', HTTPS: 'Disponibilidad HTTPS', CERTIFICATE: 'Confianza e identidad del certificado', CERTIFICATE_EXPIRY: 'Vigencia del certificado', HSTS: 'HSTS', CSP: 'Content Security Policy', FRAMING: 'Protección frente a marcos', NOSNIFF: 'Tipos de contenido', REFERRER: 'Política de referencia', COOKIE_SECURE: 'Cookies: Secure', COOKIE_HTTPONLY: 'Cookies: HttpOnly', COOKIE_SAMESITE: 'Cookies: SameSite' };

export default function AnalysisPanel({ siteId, verified }: { siteId: string; verified: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0);
  const active = jobs.some(job => ['PENDIENTE', 'EN_EJECUCION'].includes(job.estado));

  useEffect(() => {
    if (!expanded) return;
    let live = true;
    getAnalyses(siteId).then(async response => {
      if (response.status === 401) { router.replace('/login'); return; }
      if (!response.ok) throw new Error();
      const value: unknown = await response.json();
      if (!Array.isArray(value) || !value.every(v => v && typeof v.id === 'string' && typeof v.estado === 'string' && typeof v.creadoEn === 'string')) throw new Error();
      if (live) setJobs(value);
    }).catch(() => { if (live) setError('No se pudo cargar el historial. Inténtalo de nuevo.'); });
    return () => { live = false; };
  }, [expanded, siteId, refresh, router]);
  useEffect(() => {
    if (!expanded || !active) return;
    const timer = setInterval(() => setRefresh(value => value + 1), 3000);
    return () => clearInterval(timer);
  }, [expanded, active]);

  async function start() {
    setBusy(true); setError(''); setMessage(''); setDetail(null);
    try {
      const response = await csrfMutation(`/sites/${encodeURIComponent(siteId)}/analyses`);
      if (response.status === 401) { router.replace('/login'); return; }
      if (response.status !== 202) {
        const errors: Record<number, string> = { 403: 'Solicitud rechazada por origen o CSRF. Reintenta.', 404: 'Sitio no encontrado.', 409: 'Verifica el dominio o espera a que termine el análisis activo.', 429: 'Demasiadas solicitudes. Espera un minuto.', 503: 'El motor está ocupado. Inténtalo más tarde.' };
        setError(errors[response.status] || 'No se pudo iniciar el análisis.'); return;
      }
      const body = await response.json();
      if (!body || typeof body.id !== 'string') throw new Error();
      setJobs(previous => [{ id: body.id, estado: 'PENDIENTE', creadoEn: new Date().toISOString(), motivoFallo: null }, ...previous]);
      setExpanded(true); setRefresh(value => value + 1); setMessage('Análisis solicitado. Puedes consultar su estado e historial.');
    } catch { setError('No se pudo conectar con el motor de análisis.'); }
    finally { setBusy(false); }
  }
  async function show(id: string) {
    setBusy(true); setError('');
    try {
      const response = await getAnalyses(siteId, id);
      if (response.status === 401) { router.replace('/login'); return; }
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (!body || typeof body.id !== 'string' || typeof body.estado !== 'string' || !Array.isArray(body.resultados) || !body.resultados.every((r: Result) => r && typeof r.codigoComprobacion === 'string' && typeof r.estado === 'string' && (r.evidencia === null || typeof r.evidencia === 'object'))) throw new Error();
      setDetail(body);
    } catch { setError('No se pudo cargar el detalle del análisis.'); }
    finally { setBusy(false); }
  }

  return <section className="analysis-panel" aria-label="Análisis del sitio">
    <h4>Análisis manual</h4><p className="help">Revisión anónima de la página principal. Una comprobación aprobada no garantiza la ausencia de vulnerabilidades.</p>
    <MonitoringPanel siteId={siteId} verified={verified} onShowAnalysis={id => void show(id)} />
    <SslLabsPanel siteId={siteId} verified={verified} />
    {!verified && <p>Verifica la propiedad vigente del dominio para iniciar un análisis.</p>}
    <button className="submit" disabled={!verified || busy || active} onClick={() => void start()}>{busy ? 'Procesando…' : 'Iniciar análisis manual'}</button>
    <button className="text-button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Ocultar historial' : 'Ver historial'}</button>
    <p role="status">{message}</p><div role="alert">{error && <p className="form-error">{error}</p>}</div>
    {expanded && <div><h4>Historial (últimos 50)</h4><button className="text-button" onClick={() => { setError(''); setRefresh(value => value + 1); }}>Actualizar historial</button>{!jobs.length && <p>No hay análisis registrados.</p>}
      <ul>{jobs.map(job => <li key={job.id}><time>{new Date(job.creadoEn).toLocaleString('es-MX')}</time> — <strong>{labels[job.estado] || job.estado}</strong>{job.motivoFallo && <p>{job.motivoFallo}</p>} <button className="text-button" disabled={busy} onClick={() => void show(job.id)}>Ver resultados</button></li>)}</ul>
      <AnalysisComparison key={siteId} siteId={siteId} jobs={jobs} names={names} />
    </div>}
    {detail && <div aria-label="Resultados del análisis"><h4>Resultados — {labels[detail.estado] || detail.estado}</h4>{detail.motivoFallo && <p>{detail.motivoFallo}</p>}<ul className="analysis-results">{detail.resultados.map(result => <li key={result.codigoComprobacion}><h5>{names[result.codigoComprobacion] || result.codigoComprobacion}</h5><strong>{labels[result.estado] || result.estado}</strong><p>Evidencia observada:</p><dl>{Object.entries(result.evidencia || {}).filter(([key, value]) => key !== 'recommendation' && ['string', 'number', 'boolean'].includes(typeof value)).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>{result.guidance && <Recommendation guidance={result.guidance} />}{!result.guidance && typeof result.evidencia?.recommendation === 'string' && <p><strong>Recomendación y comprobación:</strong> {result.evidencia.recommendation}</p>}<p className="help">Observado: {new Date(result.observadoEn).toLocaleString('es-MX')}</p></li>)}</ul></div>}
  </section>;
}
