import { NotificationsProvider } from '../../components/notifications';
import { within, act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SitesManager from './sites-manager';
import { csrfMutation, getSites } from '../../lib/auth-api';

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => router }));
const router = { replace, refresh: jest.fn() };
jest.mock('../../lib/auth-api', () => ({ csrfMutation: jest.fn(), getSites: jest.fn() }));
const load = getSites as jest.Mock;
const mutate = csrfMutation as jest.Mock;
const site = { id: 's', domain: 'example.com', status: 'unverified', verification: null };
beforeEach(() => { jest.clearAllMocks(); load.mockResolvedValue({ ok: true, json: async () => [] }); localStorage.clear(); });

it('muestra formulario accesible y lista vacía', async () => {
  render(<SitesManager />);
  expect(screen.getByLabelText('Dominio')).toBeRequired();
  expect(await screen.findByText('Todavía no tienes sitios registrados.')).toBeInTheDocument();
});
it('rechaza URL y no hace mutaciones', async () => {
  render(<SitesManager />); await screen.findByText('Todavía no tienes sitios registrados.');
  fireEvent.change(screen.getByLabelText('Dominio'), { target: { value: 'http://example.com/path' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar sitio' }));
  expect(screen.getByRole('alert')).toHaveTextContent('sin URL ni ruta');
  expect(mutate).not.toHaveBeenCalled();
});
it('registra y muestra sitio, sin enviar propietario ni campos extra', async () => {
  render(<SitesManager />); await screen.findByText('Todavía no tienes sitios registrados.');
  mutate.mockResolvedValue({ ok: true }); load.mockResolvedValue({ ok: true, json: async () => [site] });
  fireEvent.change(screen.getByLabelText('Dominio'), { target: { value: 'example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar sitio' }));
  expect(await screen.findByRole('heading', { name: 'example.com' })).toBeInTheDocument();
  expect(mutate).toHaveBeenCalledWith('/sites', { domain: 'example.com' });
});
it.each([[409, 'ya está registrado'], [403, 'CSRF'], [429, 'Demasiados intentos'], [502, 'DNS público']])('explica error HTTP %s', async (status, message) => {
  render(<SitesManager />); await screen.findByText('Todavía no tienes sitios registrados.');
  mutate.mockResolvedValue({ ok: false, status });
  fireEvent.change(screen.getByLabelText('Dominio'), { target: { value: 'example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar sitio' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message));
});
it('genera instrucciones, comprueba archivo y no guarda el código en localStorage', async () => {
  load.mockResolvedValue({ ok: true, json: async () => [site] });
  const challenge = { id: 'c', content: `nexoguard-verification=${'a'.repeat(64)}`, url: 'https://example.com/.well-known/nexoguard-verification.txt', expiresAt: new Date(Date.now() + 60000).toISOString() };
  mutate.mockResolvedValueOnce({ ok: true, json: async () => challenge }).mockResolvedValueOnce({ ok: true });
  render(<SitesManager />);
  fireEvent.click(await screen.findByRole('button', { name: 'Generar desafío para example.com' }));
  expect(await screen.findByText(challenge.content)).toBeInTheDocument();
  expect(screen.getByText(challenge.url)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar archivo de example.com' }));
  expect(await screen.findByText(/Propiedad del dominio verificada durante 30 días/)).toBeInTheDocument();
  expect(mutate).toHaveBeenLastCalledWith('/sites/s/verification-challenges/c/check', undefined);
  expect(localStorage.length).toBe(0);
});
it('redirige cuando la sesión ya no es válida', async () => {
  load.mockResolvedValue({ status: 401 }); render(<SitesManager />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
});
it('muestra estado de carga y error de red sin detalles internos', async () => {
  let reject!: (reason: unknown) => void;
  load.mockReturnValue(new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
  render(<SitesManager />); expect(screen.getByText('Cargando sitios…')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Registrar sitio' })).toBeDisabled();
  await act(async () => { reject(new Error('internal credentials')); });
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar tus sitios.');
  expect(screen.queryByText(/internal credentials/)).not.toBeInTheDocument();
});


it('organiza varios dominios y mantiene un solo espacio de gestión abierto', async () => {
  load.mockResolvedValue({ ok: true, json: async () => [site, { ...site, id: 'second', domain: 'second.example.com' }] });
  render(<SitesManager />);
  await screen.findByRole('heading', { name: 'second.example.com' });
  expect(screen.getAllByRole('button', { name: 'Iniciar análisis manual' })).toHaveLength(1);
  const controls = screen.getAllByRole('button', { name: 'Gestionar sitio' });
  expect(controls[0]).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(controls[1]);
  expect(controls[1]).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'Generar desafío para second.example.com' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Generar desafío para example.com' })).not.toBeInTheDocument();
  expect(mutate).not.toHaveBeenCalled();
});

it('mantiene la confirmación de verificación en la tarjeta y nunca copia el código al toast', async () => {
  load.mockResolvedValue({ ok: true, json: async () => [site] });
  const challenge = { id: 'c', content: `nexoguard-verification=${'b'.repeat(64)}`, url: 'https://example.com/.well-known/nexoguard-verification.txt', expiresAt: new Date(Date.now() + 60000).toISOString() };
  mutate.mockResolvedValueOnce({ ok: true, json: async () => challenge }).mockResolvedValueOnce({ ok: true });
  render(<NotificationsProvider><SitesManager /></NotificationsProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Generar desafío para example.com' }));
  await screen.findByText(challenge.content);
  const notifications = screen.getByRole('complementary', { name: 'Notificaciones' });
  expect(within(notifications).queryByText(challenge.content)).not.toBeInTheDocument();
  const card = screen.getByRole('heading', { name: 'example.com' }).closest('.site-card')! as HTMLElement;
  expect(within(card).getByText(/Nuevo código generado/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar archivo de example.com' }));
  expect(await within(card).findByText(/Propiedad del dominio verificada durante 30 días/)).toBeInTheDocument();
  expect(document.getElementById('sites-error')).not.toHaveTextContent('Propiedad del dominio verificada');
});
it('no expone excepciones internas en errores ni en notificaciones', async () => {
  load.mockResolvedValue({ ok: true, json: async () => [site] }); mutate.mockRejectedValue(new Error('PRIVATE_DATABASE_DETAIL should never be shown'));
  render(<NotificationsProvider><SitesManager /></NotificationsProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Generar desafío para example.com' }));
  await screen.findAllByText('No se pudo completar la solicitud. Comprueba tu conexión e inténtalo de nuevo.');
  expect(document.body.textContent).not.toContain('PRIVATE_DATABASE_DETAIL');
});
it('distingue el éxito de escritura de un fallo posterior al recargar el listado', async () => {
  render(<SitesManager />); await screen.findByText('Todavía no tienes sitios registrados.');
  mutate.mockResolvedValue({ ok: true }); load.mockRejectedValueOnce(new Error('PRIVATE_READ_ERROR'));
  fireEvent.change(screen.getByLabelText('Dominio'), { target: { value: 'example.com' } }); fireEvent.click(screen.getByRole('button', { name: 'Registrar sitio' }));
  expect(await screen.findByText(/La acción fue confirmada, pero no se pudo actualizar la lista/)).toBeInTheDocument();
  expect(document.body.textContent).not.toContain('PRIVATE_READ_ERROR');
});
it('prepara el archivo descargable solo después de recibir el desafío y conserva su contenido', async () => {
  load.mockResolvedValue({ ok: true, json: async () => [site] });
  const content = `nexoguard-verification=${'c'.repeat(64)}`;
  mutate.mockResolvedValue({ ok: true, json: async () => ({ id: 'c', content, url: 'https://example.com/.well-known/nexoguard-verification.txt', expiresAt: new Date().toISOString() }) });
  const originalCreate = URL.createObjectURL; const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => 'blob:local-fixture'); URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    render(<SitesManager />); expect(screen.queryByRole('button', { name: 'Descargar archivo de verificación' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Generar desafío para example.com' }));
    const download = await screen.findByRole('button', { name: 'Descargar archivo de verificación' });
    jest.useFakeTimers(); fireEvent.click(download);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob)); expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.contexts[0]).toHaveProperty('download', 'nexoguard-verification.txt');
    expect(screen.getByText(content)).toBeInTheDocument(); expect(localStorage.length).toBe(0);
    act(() => { jest.advanceTimersByTime(1001); }); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-fixture');
  } finally { jest.useRealTimers(); click.mockRestore(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
});
