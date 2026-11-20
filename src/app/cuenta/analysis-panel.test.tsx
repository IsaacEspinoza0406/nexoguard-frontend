import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AnalysisPanel from './analysis-panel';
import { csrfMutation, getAnalyses } from '../../lib/auth-api';
const router = { replace: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('../../lib/auth-api', () => ({ csrfMutation: jest.fn(), getAnalyses: jest.fn() }));
const get = getAnalyses as jest.Mock, post = csrfMutation as jest.Mock;
beforeEach(() => { jest.clearAllMocks(); get.mockResolvedValue({ ok: true, json: async () => [] }); });
it('impide iniciar sin propiedad verificada y conserva el historial', async () => {
  render(<AnalysisPanel siteId="s" verified={false} />);
  expect(screen.getByRole('button', { name: 'Iniciar análisis manual' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Ver historial' }));
  expect(await screen.findByText('No hay análisis registrados.')).toBeInTheDocument();
});
it('inicia con CSRF y muestra estado, evidencia y recomendación', async () => {
  const job = { id: 'j', estado: 'COMPLETADO', creadoEn: new Date().toISOString(), motivoFallo: null };
  post.mockResolvedValue({ status: 202, json: async () => ({ id: 'j', estado: 'PENDIENTE' }) });
  get.mockImplementation(async (_site, id) => ({ ok: true, json: async () => id ? { ...job, resultados: [{ codigoComprobacion: 'HSTS', estado: 'HALLAZGO', observadoEn: new Date().toISOString(), evidencia: { positiveMaxAge: false, recommendation: 'Configura HSTS.' } }] } : [job] }));
  render(<AnalysisPanel siteId="s" verified />);
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar análisis manual' }));
  expect(await screen.findByText('Completado')).toBeInTheDocument();
  expect(post).toHaveBeenCalledWith('/sites/s/analyses');
  fireEvent.click(screen.getByRole('button', { name: 'Ver resultados' }));
  expect(await screen.findByText('Hallazgo')).toBeInTheDocument();
  expect(screen.getByText(/Configura HSTS/)).toBeInTheDocument();
  expect(screen.getByText('positiveMaxAge')).toBeInTheDocument();
});
it.each([[403, 'CSRF'], [409, 'Verifica el dominio'], [429, 'Demasiadas solicitudes'], [503, 'ocupado']])('maneja HTTP %s', async (status, text) => {
  post.mockResolvedValue({ status }); render(<AnalysisPanel siteId="s" verified />);
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar análisis manual' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
});
it('redirige al caducar la sesión y oculta errores de red', async () => {
  get.mockResolvedValue({ status: 401 }); render(<AnalysisPanel siteId="s" verified />);
  fireEvent.click(screen.getByRole('button', { name: 'Ver historial' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  post.mockRejectedValue(new Error('private internal details'));
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar análisis manual' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar'));
  expect(screen.queryByText(/private internal/)).not.toBeInTheDocument();
});
