import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Home from './page';

const fill = (email = 'user@example.com', password = 'contraseña-segura', confirmation = password) => {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña', { exact: true }), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: confirmation } });
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

beforeEach(() => { jest.restoreAllMocks(); localStorage.clear(); });

it('muestra campos obligatorios y sus errores', () => {
  render(<Home />); submit();
  expect(screen.getByLabelText('Correo electrónico')).toBeRequired();
  expect(screen.getByLabelText('Contraseña', { exact: true })).toBeRequired();
  expect(screen.getByLabelText('Confirmar contraseña')).toBeRequired();
  expect(screen.getByText('Introduce un correo electrónico válido.')).toBeInTheDocument();
  expect(screen.getByText('La contraseña debe tener entre 12 y 128 caracteres.')).toBeInTheDocument();
  expect(screen.getByText('Las contraseñas deben coincidir.')).toBeInTheDocument();
});

it.each(['corta', 'x'.repeat(129)])('rechaza correo inválido y contraseña fuera del rango', password => {
  render(<Home />); fill('invalido', password, 'otra'); submit();
  expect(screen.getByText('Introduce un correo electrónico válido.')).toBeInTheDocument();
  expect(screen.getByText('La contraseña debe tener entre 12 y 128 caracteres.')).toBeInTheDocument();
  expect(screen.getByText('Las contraseñas deben coincidir.')).toBeInTheDocument();
});

it('permite mostrar y ocultar las contraseñas', () => {
  render(<Home />); const input = screen.getByLabelText('Contraseña', { exact: true });
  expect(input).toHaveAttribute('type', 'password'); fireEvent.click(screen.getByLabelText('Mostrar contraseñas'));
  expect(input).toHaveAttribute('type', 'text');
});

it('envía solo los campos autorizados y muestra éxito', async () => {
  const fetchMock = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'csrf-ficticio' }) }).mockResolvedValueOnce({ status: 201, json: async () => ({ id: 'ficticio' }) });
  global.fetch = fetchMock; const storage = jest.spyOn(Storage.prototype, 'setItem');
  render(<Home />); fill(); submit();
  expect(await screen.findByText('Cuenta creada correctamente.')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ credentials: 'include' }));
  expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ credentials: 'include', body: JSON.stringify({ email: 'user@example.com', password: 'contraseña-segura' }), headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-ficticio' }) }));
  expect(storage).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0);
});

it('muestra carga mientras espera la API', async () => {
  global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
  render(<Home />); fill(); submit(); expect(screen.getByRole('button', { name: /creando cuenta/i })).toBeDisabled();
});

it.each([[409, /no se pudo registrar ese correo/i], [403, /verificar la seguridad/i], [429, /demasiados intentos/i], [400, /revisa el correo/i], [500, /servicio no pudo/i]])('informa el error HTTP %s', async (status, message) => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'token' }) }).mockResolvedValueOnce({ status });
  render(<Home />); fill(); submit(); expect(await screen.findByRole('alert')).toHaveTextContent(message);
});

it('informa fallos de red y de obtención del token', async () => {
  global.fetch = jest.fn().mockRejectedValueOnce(new Error('fallo'));
  const { unmount } = render(<Home />); fill(); submit();
  expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo conectar/i); unmount();
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 403 });
  render(<Home />); fill(); submit(); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/verificar la seguridad/i));
});
