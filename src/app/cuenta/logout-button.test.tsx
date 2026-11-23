import { NotificationsProvider } from '../../components/notifications';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LogoutButton from './logout-button';

const replace = jest.fn(); const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
beforeEach(() => jest.clearAllMocks());
it('cierra la sesión con CSRF y sale del área privada', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'ficticio' }) }).mockResolvedValueOnce({ status: 204 });
  render(<LogoutButton />); fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/auth/logout'), expect.objectContaining({ credentials: 'include' }));
});
it('muestra fallo de red y conserva el área hasta confirmar el cierre', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('red'));
  render(<LogoutButton />); fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(replace).not.toHaveBeenCalled();
});

it.each([204, 401])('distingue cierre confirmado y sesión ya caducada (HTTP %s)', async status => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'csrf-fixture' }) }).mockResolvedValueOnce({ status });
  render(<NotificationsProvider><LogoutButton /></NotificationsProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  expect(screen.getByText('Cerrando tu sesión…')).toBeInTheDocument();
  const text = status === 204 ? 'Sesión cerrada correctamente.' : 'Tu sesión ya había caducado. Inicia sesión para continuar.';
  expect(await screen.findByText(text)).toBeInTheDocument(); expect(replace).toHaveBeenCalledWith('/login');
  if (status === 401) expect(screen.queryByText('Sesión cerrada correctamente.')).not.toBeInTheDocument();
});
