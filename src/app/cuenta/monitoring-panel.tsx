'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { csrfMutation, getSiteMonitoring } from '../../lib/auth-api';

type Schedule = { activa: boolean; intervaloMinutos: number; proximaEjecucionEn: string | null; ultimoEstado: string };
type Alert = { id: string; analisisId: string; codigoComprobacion: string; tipo: string; creadoEn: string; leidaEn: string | null; detalle: Record<string, unknown> };
const states: Record<string, string> = { ESPERANDO: 'Esperando la próxima ejecución', ENCOLADO: 'Última oportunidad encolada; consulta el historial', DESACTIVADA: 'Desactivada', REQUIERE_REVISION: 'Pausada: revisa la propiedad vigente y vuelve a configurarla', OMITIDA_POR_ANALISIS_ACTIVO: 'Oportunidad omitida porque ya había un análisis activo' };
export default function MonitoringPanel({ siteId, verified, onShowAnalysis }: { siteId: string; verified: boolean; onShowAnalysis: (id: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null), [minutes, setMinutes] = useState(''), [allowed, setAllowed] = useState<number[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]), [warningDays, setWarningDays] = useState<number | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  async function load() {
    const responses = await Promise.all([getSiteMonitoring(siteId, 'schedule'), getSiteMonitoring(siteId, 'alerts')]);
    if (responses.some(r => r.status === 401)) { router.replace('/login'); return; }
    if (responses.some(r => !r.ok)) throw new Error();
    const [config, rows] = await Promise.all(responses.map(r => r.json()));
    if (!config || !Array.isArray(config.allowedMinutes) || !config.allowedMinutes.every((n: unknown) => typeof n === 'number' && n > 0) || !Array.isArray(rows) || !rows.every((r: Alert) => r && typeof r.id === 'string' && typeof r.tipo === 'string' && typeof r.analisisId === 'string')) throw new Error();
    setSchedule(config.schedule); setAllowed(config.allowedMinutes); setWarningDays(config.warningDays);
    setMinutes(config.schedule ? String(config.schedule.intervaloMinutos) : ''); setAlerts(rows); setLoaded(true);
  }
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch { setError('No se pudo completar la operación. Reintenta sin abandonar esta página.'); }
    finally { setBusy(false); }
  }
  async function mutate(path: string, body?: object) {
    const response = await csrfMutation(path, body);
    if (response.status === 401) { router.replace('/login'); return false; }
    if (!response.ok) {
      const errors: Record<number, string> = { 400: 'Selecciona una frecuencia aprobada.', 403: 'Solicitud rechazada por origen o CSRF. Reintenta.', 404: 'Sitio o alerta no encontrado.', 409: 'Verifica la revisión actual del dominio antes de activar.', 429: 'Demasiadas solicitudes. Espera antes de reintentar.' };
      setError(errors[response.status] || 'No se pudo guardar el cambio.'); return false;
    }
    return true;
  }
  function frequency(n: number) { return n === 1440 ? 'Diaria (cada 24 horas)' : n === 10080 ? 'Semanal (cada 7 días)' : `Cada ${n} minutos`; }
  return <section aria-label="Programación y alertas">
    <button className="text-button" aria-expanded={open} disabled={busy} onClick={() => { setOpen(!open); if (!open) void action(load); }}>{open ? 'Ocultar programación y alertas' : 'Programación y alertas'}</button>
    {open && <div><h4>Programación de análisis</h4>
      <p>Reutiliza el motor de la página principal y exige propiedad vigente en cada ejecución. Las oportunidades perdidas durante una interrupción no se acumulan.</p>
      {busy && <p role="status">Procesando monitoreo…</p>}{error && <p role="alert">{error}</p>}<p role="status">{message}</p>
      {loaded && <>
        <p>{schedule ? states[schedule.ultimoEstado] || schedule.ultimoEstado : 'Sin programación configurada.'}</p>
        {schedule?.proximaEjecucionEn && <p>Próxima oportunidad: <time>{new Date(schedule.proximaEjecucionEn).toLocaleString('es-MX')}</time></p>}
        {!allowed.length && <p>Las frecuencias están pendientes de aprobación. No se puede activar la programación.</p>}
        {!verified && <p>Renueva y verifica la propiedad para habilitar la programación.</p>}
        <label htmlFor={`frequency-${siteId}`}>Frecuencia</label>
        <select id={`frequency-${siteId}`} value={minutes} disabled={busy || !verified || !allowed.length} onChange={e => setMinutes(e.target.value)}><option value="">Selecciona frecuencia</option>{allowed.map(n => <option key={n} value={n}>{frequency(n)}</option>)}</select>
        <button className="text-button" disabled={busy || !verified || !allowed.includes(Number(minutes))} onClick={() => void action(async () => { if (await mutate(`/sites/${encodeURIComponent(siteId)}/schedule`, { enabled: true, intervalMinutes: Number(minutes) })) { await load(); setMessage('Programación guardada. La primera ejecución será después del intervalo elegido.'); } })}>Guardar programación</button>
        <button className="text-button" disabled={busy || !schedule?.activa} onClick={() => void action(async () => { if (await mutate(`/sites/${encodeURIComponent(siteId)}/schedule`, { enabled: false })) { await load(); setMessage('Programación desactivada. Un trabajo ya iniciado puede terminar.'); } })}>Desactivar programación</button>
        <h4>Alertas (últimas 50)</h4><p>Se muestran en esta aplicación; no se envían correos. Marcar como leída no corrige el hallazgo.</p>
        <p>{warningDays === null ? 'Ventana de aviso de certificados pendiente de aprobación.' : `Aviso de certificado observado: ${warningDays} días o menos, incluido vencido. No es una comprobación continua del certificado.`}</p>
        <button className="text-button" disabled={busy} onClick={() => void action(load)}>Actualizar monitoreo</button>
        {!alerts.length && <p>No hay alertas registradas.</p>}
        <ul className="analysis-results">{alerts.map(alert => <li key={alert.id}>
          <h5>{alert.tipo === 'EMPEORAMIENTO' ? 'Comprobación que empeoró' : 'Vigencia del certificado'} — {alert.codigoComprobacion}</h5>
          <p>{alert.leidaEn ? 'Leída' : 'Sin leer'} · <time>{new Date(alert.creadoEn).toLocaleString('es-MX')}</time></p>
          {alert.tipo === 'EMPEORAMIENTO' ? <p>Pasó de aprobada a hallazgo en análisis comparables de la misma revisión.</p> : <p>Según la observación guardada, el certificado vence en {typeof alert.detalle?.venceEn === 'string' ? new Date(alert.detalle.venceEn).toLocaleString('es-MX') : 'fecha no disponible'}. Revisa la evidencia; puede haber cambiado desde entonces.</p>}
          <button className="text-button" disabled={busy} onClick={() => onShowAnalysis(alert.analisisId)}>Ver análisis de la alerta</button>
          {!alert.leidaEn && <button className="text-button" disabled={busy} onClick={() => void action(async () => { if (await mutate(`/sites/${encodeURIComponent(siteId)}/alerts/${encodeURIComponent(alert.id)}/read`)) { await load(); setMessage('Alerta marcada como leída.'); } })}>Marcar como leída</button>}
        </li>)}</ul>
      </>}
    </div>}
  </section>;
}
