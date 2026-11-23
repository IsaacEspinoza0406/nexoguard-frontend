import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { NotificationsProvider, useNotifications } from './notifications';

function Harness() {
  const { notify } = useNotifications();
  return <><button onClick={() => notify('save', 'progress', 'Guardando cambios…')}>Guardar</button><button onClick={() => notify('save', 'success', 'Cambio confirmado por la API.')}>Confirmar</button><button onClick={() => notify('save', 'error', 'Revisa la configuración del sitio.')}>Fallar</button><button onClick={() => { for (let n = 0; n < 8; n++) notify(`notice-${n}`, 'info', `Información ${n}`); }}>Informar</button></>;
}
function setup() { render(<NotificationsProvider><Harness /></NotificationsProvider>); return screen.getByRole('complementary', { name: 'Notificaciones' }); }
afterEach(() => { jest.useRealTimers(); });
it('reemplaza el progreso y deduplica el mismo aviso por operación', () => {
  const region = setup(); fireEvent.click(screen.getByText('Guardar')); fireEvent.click(screen.getByText('Guardar'));
  expect(within(region).getAllByText('Guardando cambios…')).toHaveLength(1);
  expect(within(region).queryByText('Cambio confirmado por la API.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Confirmar'));
  expect(within(region).queryByText('Guardando cambios…')).not.toBeInTheDocument();
  expect(within(region).getByRole('status')).toHaveTextContent('Cambio confirmado por la API.');
});
it('usa alert para errores persistentes y permite cerrarlos con un botón nativo accesible', () => {
  jest.useFakeTimers(); const region = setup(); fireEvent.click(screen.getByText('Fallar'));
  act(() => { jest.advanceTimersByTime(120000); });
  expect(within(region).getByRole('alert')).toHaveTextContent('Revisa la configuración');
  const close = within(region).getByRole('button', { name: 'Cerrar notificación: Requiere atención' }); act(() => close.focus()); expect(close).toHaveFocus(); fireEvent.click(close);
  expect(within(region).queryByRole('alert')).not.toBeInTheDocument();
});
it('pausa el cierre automático mientras una persona tiene el foco en la notificación', () => {
  jest.useFakeTimers(); const region = setup(); fireEvent.click(screen.getByText('Confirmar'));
  fireEvent.focus(within(region).getByRole('button'));
  act(() => { jest.advanceTimersByTime(9000); }); expect(within(region).getByRole('status')).toBeInTheDocument();
  fireEvent.blur(within(region).getByRole('button'), { relatedTarget: null });
  act(() => { jest.advanceTimersByTime(8001); }); expect(within(region).queryByRole('status')).not.toBeInTheDocument();
});
it('limita las notificaciones simultáneas y no necesita almacenamiento persistente', () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem'); const region = setup(); fireEvent.click(screen.getByText('Informar'));
  expect(within(region).getAllByRole('status')).toHaveLength(4); expect(spy).not.toHaveBeenCalled(); spy.mockRestore();
});
