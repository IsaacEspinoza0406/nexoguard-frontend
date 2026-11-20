import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MonitoringPanel from './monitoring-panel';
import { csrfMutation, getSiteMonitoring } from '../../lib/auth-api';
const router = { replace: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('../../lib/auth-api', () => ({ csrfMutation: jest.fn(), getSiteMonitoring: jest.fn() }));
const get = getSiteMonitoring as jest.Mock, post = csrfMutation as jest.Mock;
const show = jest.fn();
let schedule: { activa: boolean; intervaloMinutos: number; proximaEjecucionEn: string | null; ultimoEstado: string } | null;
beforeEach(() => { jest.clearAllMocks(); schedule = null; get.mockImplementation(async (_site, resource) => ({ ok: true, json: async () => resource === 'schedule' ? { schedule, allowedMinutes: [1440, 10080], warningDays: 30, channel: 'IN_APP' } : [] })); post.mockResolvedValue({ ok: true }); });
function open(verified = true) { render(<MonitoringPanel siteId="s" verified={verified} onShowAnalysis={show} />); fireEvent.click(screen.getByRole('button', { name: 'Programación y alertas' })); }
it('carga, configura y modifica la frecuencia mediante CSRF', async () => {
  open(); await screen.findByText('Sin programación configurada.');
  fireEvent.change(screen.getByLabelText('Frecuencia'), { target: { value: '1440' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar programación' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/sites/s/schedule', { enabled: true, intervalMinutes: 1440 }));
  await screen.findByText(/Programación guardada/);
  fireEvent.change(screen.getByLabelText('Frecuencia'), { target: { value: '10080' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar programación' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/sites/s/schedule', { enabled: true, intervalMinutes: 10080 }));
});
it('permite desactivar aunque haya vencido la propiedad', async () => {
  schedule = { activa: true, intervaloMinutos: 1440, proximaEjecucionEn: new Date().toISOString(), ultimoEstado: 'ESPERANDO' };
  open(false); await screen.findByText('Esperando la próxima ejecución');
  expect(screen.getByRole('button', { name: 'Guardar programación' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Desactivar programación' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/sites/s/schedule', { enabled: false }));
});
it('muestra decisiones pendientes sin inventar una frecuencia', async () => {
  get.mockImplementation(async (_site, resource) => ({ ok: true, json: async () => resource === 'schedule' ? { schedule: null, allowedMinutes: [], warningDays: null } : [] }));
  open(); expect(await screen.findByText(/frecuencias están pendientes/)).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Guardar programación' })).toBeDisabled(); expect(screen.getByText(/Ventana de aviso.*pendiente/)).toBeInTheDocument();
});
it('muestra alertas, accede a evidencia y marca leída sin presentarla como resuelta', async () => {
  get.mockImplementation(async (_site, resource) => ({ ok: true, json: async () => resource === 'schedule' ? { schedule: null, allowedMinutes: [1440], warningDays: 30 } : [{ id: 'a', analisisId: 'j', codigoComprobacion: 'HSTS', tipo: 'EMPEORAMIENTO', creadoEn: new Date().toISOString(), leidaEn: null, detalle: {} }] }));
  open(); await screen.findByText(/Comprobación que empeoró/);
  fireEvent.click(screen.getByRole('button', { name: 'Ver análisis de la alerta' })); expect(show).toHaveBeenCalledWith('j');
  fireEvent.click(screen.getByRole('button', { name: 'Marcar como leída' })); await waitFor(() => expect(post).toHaveBeenCalledWith('/sites/s/alerts/a/read', undefined));
  expect(screen.getByText(/Marcar como leída no corrige/)).toBeInTheDocument();
});
it.each([[403, 'CSRF'], [409, 'Verifica la revisión'], [429, 'Demasiadas solicitudes']])('maneja rechazo %s', async (status, text) => {
  post.mockResolvedValue({ ok: false, status }); open(); await screen.findByText('Sin programación configurada.');
  fireEvent.change(screen.getByLabelText('Frecuencia'), { target: { value: '1440' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar programación' })); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
});
it('maneja errores de red y sesión caducada sin mostrar detalles internos', async () => {
  get.mockRejectedValueOnce(new Error('private')); open(); expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar'); expect(screen.queryByText('private')).not.toBeInTheDocument();
  get.mockResolvedValue({ status: 401 }); fireEvent.click(screen.getByRole('button', { name: 'Ocultar programación y alertas' })); fireEvent.click(screen.getByRole('button', { name: 'Programación y alertas' })); await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
});
