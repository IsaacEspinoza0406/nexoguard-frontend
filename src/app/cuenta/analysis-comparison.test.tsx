import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AnalysisComparison, { Recommendation, Guidance } from './analysis-comparison';
import { getAnalysisComparison } from '../../lib/auth-api';
const router = { replace: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('../../lib/auth-api', () => ({ getAnalysisComparison: jest.fn() }));
const get = getAnalysisComparison as jest.Mock;
const jobs = ['a', 'b'].map((id, index) => ({ id, estado: 'COMPLETADO', creadoEn: new Date(index * 10000).toISOString() }));
const guidance: Guidance = { version: 'catalog-v1', explanation: 'Explicación contextual', consequence: 'Consecuencia posible', applicability: 'Condiciones de aplicación', correctiveAction: 'Corrección sugerida', verification: 'Verificación posterior' };
function select() {
  fireEvent.change(screen.getByLabelText('Análisis base (anterior)'), { target: { value: 'a' } });
  fireEvent.change(screen.getByLabelText('Análisis de destino (posterior)'), { target: { value: 'b' } });
  fireEvent.click(screen.getByRole('button', { name: 'Comparar selección' }));
}
beforeEach(() => jest.clearAllMocks());
it('exige dos análisis distintos y ofrece solo terminales', () => {
  render(<AnalysisComparison siteId="s" jobs={[...jobs, { id: 'pending', estado: 'PENDIENTE', creadoEn: new Date().toISOString() }]} names={{}} />);
  expect(screen.getByRole('button', { name: 'Comparar selección' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Análisis base (anterior)'), { target: { value: 'a' } });
  fireEvent.change(screen.getByLabelText('Análisis de destino (posterior)'), { target: { value: 'a' } });
  expect(screen.getByRole('button', { name: 'Comparar selección' })).toBeDisabled();
  expect(screen.queryByRole('option', { name: /PENDIENTE/ })).not.toBeInTheDocument();
});
it('muestra los cuatro cambios, ausencia de datos y catálogo contextual sin puntuación', async () => {
  get.mockResolvedValue({ ok: true, json: async () => ({ before: { id: 'a' }, after: { id: 'b' }, results: ['MEJORO', 'EMPEORO', 'IGUAL', 'NO_COMPARABLE'].map((change, index) => ({ code: `rule-${index}`, before: index === 3 ? null : 'HALLAZGO', after: index === 3 ? 'NO_EVALUADO' : 'APROBADO', change, reason: 'Regla explícita', guidance })) }) });
  render(<AnalysisComparison siteId="s" jobs={jobs} names={{ 'rule-0': 'HSTS' }} />); select();
  expect(await screen.findByText('Mejoró')).toBeInTheDocument();
  for (const text of ['Empeoró', 'Permaneció igual', 'No comparable', 'HSTS']) expect(screen.getByText(text)).toBeInTheDocument();
  expect(screen.getByText(/Anterior: Sin datos → Posterior: No evaluado/)).toBeInTheDocument();
  expect(screen.getAllByText('Corrección sugerida')).toHaveLength(4);
  expect(get).toHaveBeenCalledWith('s', 'a', 'b');
  fireEvent.change(screen.getByLabelText('Análisis base (anterior)'), { target: { value: 'b' } });
  expect(screen.queryByText('Mejoró')).not.toBeInTheDocument();
});
it.each([[400, 'orden cronológico'], [404, 'sin autorización'], [409, 'misma revisión'], [429, 'Demasiadas solicitudes'], [500, 'No se pudo obtener']])('maneja HTTP %s', async (status, text) => {
  get.mockResolvedValue({ status, ok: false }); render(<AnalysisComparison siteId="s" jobs={jobs} names={{}} />); select();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
});
it('muestra espera, errores seguros y sesión caducada', async () => {
  let resolve!: (value: object) => void; get.mockReturnValue(new Promise(r => { resolve = r; }));
  render(<AnalysisComparison siteId="s" jobs={jobs} names={{}} />); select();
  expect(screen.getByRole('button', { name: 'Comparando…' })).toBeDisabled();
  resolve({ status: 401 }); await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  get.mockRejectedValue(new Error('private internal data')); select();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar'));
  expect(screen.queryByText(/private internal/)).not.toBeInTheDocument();
});
it('presenta los cinco elementos RF-011 separados de la evidencia', () => {
  render(<Recommendation guidance={guidance} />);
  for (const text of ['Explicación', 'Posible consecuencia', 'Cuándo aplica', 'Acción orientativa según aplicabilidad', 'Cómo comprobarla']) expect(screen.getByText(text)).toBeInTheDocument();
});
