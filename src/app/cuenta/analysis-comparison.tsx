'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAnalysisComparison } from '../../lib/auth-api';
import { StatusBadge } from '../../components/ui';

export type Guidance = { version: string; explanation: string; consequence: string; applicability: string; correctiveAction: string; verification: string };
export function Recommendation({ guidance }: { guidance: Guidance }) {
  return <dl className="recommendation">
    <div><dt>Explicación</dt><dd>{guidance.explanation}</dd></div>
    <div><dt>Posible consecuencia</dt><dd>{guidance.consequence}</dd></div>
    <div><dt>Cuándo aplica</dt><dd>{guidance.applicability}</dd></div>
    <div><dt>Acción correctiva</dt><dd>{guidance.correctiveAction}</dd></div>
    <div><dt>Cómo comprobarla</dt><dd>{guidance.verification}</dd></div>
    <div><dt>Catálogo orientativo actual</dt><dd>{guidance.version}; separado de las reglas históricas.</dd></div>
  </dl>;
}
type Job = { id: string; estado: string; creadoEn: string };
type Row = { code: string; before: string | null; after: string | null; change: string; reason: string; guidance: Guidance | null };
const labels: Record<string, string> = { MEJORO: 'Mejoró', EMPEORO: 'Empeoró', IGUAL: 'Permaneció igual', NO_COMPARABLE: 'No comparable', APROBADO: 'Comprobación aprobada', HALLAZGO: 'Hallazgo', NO_APLICABLE: 'No aplicable', NO_EVALUADO: 'No evaluado' };

export default function AnalysisComparison({ siteId, jobs, names }: { siteId: string; jobs: Job[]; names: Record<string, string> }) {
  const router = useRouter();
  const [before, setBefore] = useState(''), [after, setAfter] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const options = jobs.filter(job => ['COMPLETADO', 'FALLIDO'].includes(job.estado));
  async function compare() {
    setBusy(true); setError(''); setRows(null);
    try {
      const response = await getAnalysisComparison(siteId, before, after);
      if (response.status === 401) { router.replace('/login'); return; }
      if (!response.ok) {
        const errors: Record<number, string> = { 400: 'Elige dos análisis distintos en orden cronológico.', 404: 'Análisis no encontrados o sin autorización.', 409: 'Selecciona análisis de la misma revisión del dominio.', 429: 'Demasiadas solicitudes. Espera antes de reintentar.' };
        setError(errors[response.status] || 'No se pudo obtener la comparación.'); return;
      }
      const data = await response.json();
      if (!data || data.before?.id !== before || data.after?.id !== after || !Array.isArray(data.results) || !data.results.every((r: Row) => r && typeof r.code === 'string' && ['MEJORO', 'EMPEORO', 'IGUAL', 'NO_COMPARABLE'].includes(r.change) && typeof r.reason === 'string')) throw new Error();
      setRows(data.results);
    } catch { setError('No se pudo conectar para comparar. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  function select(value: string, baseline: boolean) { if (baseline) setBefore(value); else setAfter(value); setRows(null); setError(''); }
  return <section className="comparison-section" aria-label="Comparación de análisis">
    <h4>Comparar análisis</h4>
    <p className="help">Selecciona dos análisis de la misma revisión, del más antiguo al más reciente. Los fallos, las comprobaciones no evaluadas y los datos ausentes no prueban mejoras. No hay una puntuación global.</p>
    <label htmlFor={`before-${siteId}`}>Análisis base (anterior)</label>
    <select id={`before-${siteId}`} value={before} disabled={busy} onChange={e => select(e.target.value, true)}><option value="">Selecciona un análisis</option>{options.map((job, index) => <option key={job.id} value={job.id}>{new Date(job.creadoEn).toLocaleString('es-MX')} — {job.estado} — #{index + 1}</option>)}</select>
    <label htmlFor={`after-${siteId}`}>Análisis de destino (posterior)</label>
    <select id={`after-${siteId}`} value={after} disabled={busy} onChange={e => select(e.target.value, false)}><option value="">Selecciona un análisis</option>{options.map((job, index) => <option key={job.id} value={job.id}>{new Date(job.creadoEn).toLocaleString('es-MX')} — {job.estado} — #{index + 1}</option>)}</select>
    <button className="text-button" disabled={busy || !before || !after || before === after} onClick={() => void compare()}>{busy ? 'Comparando…' : 'Comparar selección'}</button>
    {error && <p role="alert">{error}</p>}
    {rows && <div aria-live="polite"><h5>Comparación por comprobación</h5><ul className="analysis-results">{rows.map(row => <li key={row.code}>
      <h5>{names[row.code] || row.code}</h5><StatusBadge status={row.change}>{labels[row.change]}</StatusBadge>
      <p>Anterior: {row.before ? labels[row.before] || row.before : 'Sin datos'} → Posterior: {row.after ? labels[row.after] || row.after : 'Sin datos'}</p><p>{row.reason}</p>
      {row.guidance && <details><summary>Explicación y recomendación</summary><Recommendation guidance={row.guidance} /></details>}
    </li>)}</ul></div>}
  </section>;
}
