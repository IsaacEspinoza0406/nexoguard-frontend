'use client';

import { useId, useState } from 'react';

export type PracticalGuideData = { version: string; examples: {
  technology: string; location: string; deficient: string; corrected: string;
  steps: string[]; verification: string; expected: string; caution: string;
}[] };

export default function PracticalGuide({ guide, status }: { guide: PracticalGuideData; status?: string | null }) {
  const id = useId();
  const [technology, setTechnology] = useState('');
  const [copy, setCopy] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const example = guide.examples.find(item => item.technology === technology);
  const uncertain = status === 'NO_EVALUADO' || status === 'NO_APLICABLE' || !status;
  async function copyCorrected() {
    if (!example?.corrected || copy === 'busy') return;
    setCopy('busy');
    try { await navigator.clipboard.writeText(example.corrected); setCopy('done'); }
    catch { setCopy('error'); }
  }
  return <section className="practical-guide" aria-labelledby={`${id}-heading`}>
    <h6 id={`${id}-heading`}>Guía práctica · Ejemplo orientativo</h6>
    <p className="help">No conocemos el código de tu sitio. Elige la tecnología que administras; estos ejemplos no sustituyen su configuración completa.</p>
    {uncertain && <p className="guide-notice">{status === 'NO_APLICABLE' ? 'No aplicable: no hay evidencia que requiera esta corrección en la respuesta observada. Revisa primero las condiciones de aplicación indicadas arriba.' : 'No evaluado o sin datos suficientes: esta guía no demuestra un fallo ni una mejora. Revisa el motivo y las condiciones de aplicación antes de modificar el sitio.'}</p>}
    {status === 'APROBADO' && <p className="guide-notice">Comprobación aprobada en la observación. No es necesario cambiarla solo por este ejemplo; conserva las protecciones existentes.</p>}
    <label htmlFor={`${id}-technology`}>Tecnología de tu sitio</label>
    <select id={`${id}-technology`} value={technology} disabled={copy === 'busy'} onChange={event => { setTechnology(event.target.value); setCopy('idle'); }}>
      <option value="">Selecciona tu tecnología</option>
      {guide.examples.map(item => <option key={item.technology} value={item.technology}>{item.technology}</option>)}
    </select>
    {example && <div className="guide-content">
      <p><strong>Dónde se modifica:</strong> {example.location}</p>
      <p className="guide-notice">{example.caution}</p>
      <div className="guide-code-grid"><div><h6>Antes · deficiente e ilustrativo</h6><pre tabIndex={0} aria-label="Ejemplo deficiente ilustrativo"><code>{example.deficient}</code></pre></div>
        {example.corrected && <div><h6>Configuración orientativa corregida</h6><pre tabIndex={0} aria-label="Ejemplo corregido"><code>{example.corrected}</code></pre><button type="button" className="text-button" disabled={copy === 'busy'} onClick={() => void copyCorrected()}>{copy === 'busy' ? 'Copiando…' : 'Copiar ejemplo corregido'}</button></div>}
      </div>
      <p role={copy === 'error' ? 'alert' : 'status'} aria-live="polite">{copy === 'done' ? 'Ejemplo corregido copiado.' : copy === 'error' ? 'No se pudo copiar. Selecciona el bloque corregido y cópialo manualmente.' : ''}</p>
      <h6>Cómo aplicarlo</h6><ol>{example.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
      <h6>Cómo comprobarlo</h6><pre tabIndex={0} aria-label="Comprobación orientativa"><code>{example.verification}</code></pre>
      <p><strong>Resultado esperado:</strong> {example.expected}</p>
    </div>}
    <p className="help">{guide.version} · catálogo orientativo actual, independiente de las reglas, evidencia y fecha del análisis histórico.</p>
  </section>;
}
