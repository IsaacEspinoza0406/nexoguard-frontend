import { render, screen } from '@testing-library/react';
import Account from './page';
jest.mock('./sites-manager', () => ({ __esModule: true, default: () => <div>Sitios</div> }));

const getCookie = jest.fn();
jest.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => getCookie(name) }) }));
jest.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }) }));
beforeEach(() => { jest.clearAllMocks(); });

it('no muestra contenido privado sin cookie', async () => {
  getCookie.mockReturnValue(undefined); global.fetch = jest.fn();
  await expect(Account()).rejects.toThrow('redirect:/login'); expect(fetch).not.toHaveBeenCalled();
});
it('consulta al servidor y redirige si la sesión está revocada', async () => {
  getCookie.mockImplementation(name => name === 'nexoguard_session' ? { name, value: 'a'.repeat(64) } : undefined);
  global.fetch = jest.fn().mockResolvedValue({ status: 401 });
  await expect(Account()).rejects.toThrow('redirect:/login');
});
it('solo renderiza la cuenta después de validar la sesión en la API', async () => {
  getCookie.mockImplementation(name => name === 'nexoguard_session' ? { name, value: 'a'.repeat(64) } : undefined);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'u', email: 'u@example.com' }) });
  render(await Account()); expect(screen.getByText(/u@example.com/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/me'), expect.objectContaining({ cache: 'no-store' }));
});
