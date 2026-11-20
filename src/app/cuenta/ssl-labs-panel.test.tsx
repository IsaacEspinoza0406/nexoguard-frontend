import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SslLabsPanel from './ssl-labs-panel';
import { csrfMutation, getSslLabs } from '../../lib/auth-api';
const router = { replace: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('../../lib/auth-api', () => ({ csrfMutation: jest.fn(), getSslLabs: jest.fn() }));
const get = getSslLabs as jest.Mock, post = csrfMutation as jest.Mock;
beforeEach(() => { jest.clearAllMocks(); get.mockResolvedValue({ ok: true, json: async () => ({ configured: true, reason: null, reports: [] }) }); });
function open(verified = true) { render(<SslLabsPanel siteId="s" verified={verified} />); fireEvent.click(screen.getByRole('button', { name: 'SSL Labs complementario' })); }
async function submit() { await screen.findByText('No hay consultas SSL Labs registradas.'); fireEvent.click(screen.getByRole('checkbox')); await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Solicitar SSL Labs' })); }); }
it('explica ejecución por Qualys y exige consentimiento, configuración y propiedad', async () => {
  open(false); await screen.findByText('No hay consultas SSL Labs registradas.');
  expect(screen.getByRole('button', { name: 'Solicitar SSL Labs' })).toBeDisabled();
  expect(screen.getByText(/Qualys recibirá el dominio/)).toBeInTheDocument();
});
it('muestra dato externo pendiente sin impedir resultados propios', async () => {
  get.mockResolvedValue({ ok: true, json: async () => ({ configured: false, reason: 'Falta correo institucional registrado.', reports: [] }) });
  open(); expect(await screen.findByText('Falta correo institucional registrado.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Solicitar SSL Labs' })).toBeDisabled();
});
it('solicita con consentimiento y CSRF, informa caché y no guarda datos sensibles', async () => {
  post.mockResolvedValue({ status: 202 }); open(); await submit();
  await screen.findByText(/Consulta externa solicitada/); expect(post).toHaveBeenCalledWith('/sites/s/ssl-labs', { consent: true }); expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});
it.each([[403, 'CSRF'], [409, 'propiedad vigente'], [429, 'Demasiadas solicitudes'], [503, 'correo institucional']])('maneja HTTP %s', async (status, text) => {
  post.mockResolvedValue({ status }); open(); await submit(); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
});
it('presenta procedencia, fecha del proveedor, notas y fallos parciales sin calificarlos como propios', async () => {
  get.mockResolvedValue({ ok: true, json: async () => ({ configured: true, reports: [{ id: 'j', estado: 'COMPLETADO', creadoEn: '2026-11-20T12:00:00Z', motivoFallo: null, disponibleEn: '2026-11-20T12:00:30Z', report: { phase: 'READY', fetchedAt: '2026-11-20T12:00:20Z', testTime: '2026-11-20T11:00:00Z', engineVersion: '2.4', criteriaVersion: '2025a', endpoints: [{ endpoint: 1, status: 'READY', grade: 'A', hasWarnings: false }, { endpoint: 2, status: 'ERROR', grade: null, hasWarnings: false }] } }] }) });
  open(); await screen.findByText('Informe disponible');
  expect(screen.getByText('Procedencia: Qualys SSL Labs API v4')).toBeInTheDocument(); expect(screen.getByText(/Fecha de evaluación del proveedor:/)).toBeInTheDocument(); expect(screen.getByText(/Endpoint 1: Nota del proveedor: A/)).toBeInTheDocument(); expect(screen.getByText(/Endpoint 2: No pudo evaluarse/)).toBeInTheDocument();
});
it('distingue espera de error y mantiene la consulta independiente', async () => {
  get.mockResolvedValue({ ok: true, json: async () => ({ configured: true, reports: [{ id: 'j', estado: 'PENDIENTE', creadoEn: new Date().toISOString(), disponibleEn: new Date().toISOString(), report: { phase: 'WAITING', reason: 'Proveedor ocupado.', endpoints: [] } }] }) });
  open(); await screen.findByText('En espera del proveedor'); expect(screen.getByText('Proveedor ocupado.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Solicitar SSL Labs' })).toBeDisabled();
});
it('maneja sesión caducada y error de red sin filtrar detalles', async () => {
  get.mockRejectedValue(new Error('private')); open(); expect(await screen.findByRole('alert')).toHaveTextContent('resultados propios siguen disponibles'); expect(screen.queryByText('private')).not.toBeInTheDocument();
  expect(screen.queryByText('Cargando estado de SSL Labs…')).not.toBeInTheDocument();
  get.mockResolvedValue({ status: 401 }); fireEvent.click(screen.getByRole('button', { name: 'Actualizar SSL Labs' })); await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
});

function savedReport() {
  return { configured: true, reports: [{ id: 'saved', estado: 'COMPLETADO', creadoEn: '2026-11-20T12:00:00Z', motivoFallo: null as string | null, disponibleEn: '2026-11-20T12:01:00Z', report: { phase: 'READY', testTime: '2026-11-20T12:00:30Z', endpoints: [1, 2, 3, 4].map(endpoint => ({ endpoint, status: 'READY', grade: 'A', hasWarnings: false })) } }] };
}
it.each(['http', 'network', 'invalid'])('conserva las cuatro notas A ante fallo de actualización %s y limpia el aviso al recuperarse', async failure => {
  get.mockResolvedValue({ ok: true, json: async () => savedReport() });
  open(); await screen.findByText('Informe disponible');
  if (failure === 'http') get.mockResolvedValueOnce({ ok: false, status: 500 });
  else if (failure === 'network') get.mockRejectedValueOnce(new Error('private connection details'));
  else get.mockResolvedValueOnce({ ok: true, json: async () => ({ reports: null }) });
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar SSL Labs' }));
  const warning = await screen.findByRole('alert');
  expect(warning).toHaveTextContent('No se pudo actualizar el estado guardado');
  expect(warning).toHaveTextContent('no indica que la evaluación haya fallado');
  if (failure === 'http') expect(warning).toHaveTextContent('HTTP 500');
  expect(screen.getAllByText(/Nota del proveedor: A/)).toHaveLength(4);
  expect(screen.getByText('Informe disponible')).toBeInTheDocument();
  expect(screen.queryByText(/Consulta fallida/)).not.toBeInTheDocument();
  expect(screen.queryByText(/private connection details/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar SSL Labs' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getAllByText(/Nota del proveedor: A/)).toHaveLength(4);
  expect(post).not.toHaveBeenCalled();
});
it('un trabajo externo fallido permanece identificado tras recuperar el listado correctamente', async () => {
  const data = savedReport();
  data.reports.push({ ...data.reports[0], id: 'failed', estado: 'FALLIDO', motivoFallo: 'El proveedor no pudo completar la consulta.', report: { ...data.reports[0].report, phase: 'ERROR', endpoints: [] } });
  get.mockRejectedValueOnce(new Error('private')).mockResolvedValue({ ok: true, json: async () => data });
  open(); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar SSL Labs' }));
  await screen.findByText('Consulta fallida');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('El proveedor no pudo completar la consulta.')).toBeInTheDocument();
  expect(screen.getAllByText(/Nota del proveedor: A/)).toHaveLength(4);
  expect(post).not.toHaveBeenCalled();
});
