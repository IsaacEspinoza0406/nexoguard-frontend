import { fireEvent, render, screen } from '@testing-library/react';
import Login from './page';

const replace = jest.fn(); const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
beforeEach(() => { jest.clearAllMocks(); });
const fill = () => { fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'user@example.com' } }); fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-ficticia-123' } }); };

it('valida las entradas sin hacer solicitudes', () => {
  global.fetch = jest.fn(); render(<Login />);
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/correo válido/i);
  expect(fetch).not.toHaveBeenCalled();
});

it('obtiene CSRF, incluye credenciales y navega al área privada', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'csrf-ficticio' }) }).mockResolvedValueOnce({ ok: true, status: 200 });
  render(<Login />); fill(); fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(await screen.findByRole('button', { name: 'Accediendo…' })).toBeDisabled();
  await screen.findByRole('button', { name: 'Iniciar sesión' });
  expect(replace).toHaveBeenCalledWith('/cuenta');
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/auth/login'), expect.objectContaining({ credentials: 'include', body: JSON.stringify({ email: 'user@example.com', password: 'clave-ficticia-123' }), headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-ficticio' }) }));
  expect(localStorage.length).toBe(0);
});

it.each([401, 403, 429, 500])('informa un fallo %s sin navegar', async status => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'token' }) }).mockResolvedValueOnce({ ok: false, status });
  render(<Login />); fill(); fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(replace).not.toHaveBeenCalled();
});
