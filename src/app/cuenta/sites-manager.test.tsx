import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
