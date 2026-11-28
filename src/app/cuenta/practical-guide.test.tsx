import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PracticalGuide, { PracticalGuideData } from './practical-guide';

const guide: PracticalGuideData = { version: 'practical-v1', examples: [{ technology: 'Cloudflare Pages', location: '_headers', deficient: '/*\n  ! Strict-Transport-Security', corrected: '/*\n  Strict-Transport-Security: max-age=300', steps: ['Conserva las otras cabeceras.', 'Publica en tu proyecto.'], caution: '300 segundos es laboratorio.', verification: 'curl --head https://tu-dominio.example/', expected: 'max-age positivo' }] };
function select() { fireEvent.change(screen.getByLabelText('Tecnología de tu sitio'), { target: { value: 'Cloudflare Pages' } }); }
it('no infiere tecnología, muestra pasos y copia solo el bloque corregido tras confirmación', async () => {
  let complete!: () => void;
  const writeText = jest.fn(() => new Promise<void>(resolve => { complete = resolve; }));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<PracticalGuide guide={guide} status="HALLAZGO" />);
  expect(screen.queryByText('Dónde se modifica:')).not.toBeInTheDocument();
  select();
  fireEvent.click(screen.getByRole('button', { name: 'Copiar ejemplo corregido' }));
  expect(writeText).toHaveBeenCalledWith(guide.examples[0].corrected);
  expect(screen.queryByText('Ejemplo corregido copiado.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copiando…' })).toBeDisabled();
  complete();
  expect(await screen.findByText('Ejemplo corregido copiado.')).toBeInTheDocument();
});
it('mantiene error de copia visible y permite alternativa manual', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
  render(<PracticalGuide guide={guide} status="HALLAZGO" />); select();
  fireEvent.click(screen.getByRole('button', { name: 'Copiar ejemplo corregido' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo copiar'));
});
it.each(['NO_APLICABLE', 'NO_EVALUADO', 'APROBADO'])('explica el estado %s sin exigir corrección', status => {
  render(<PracticalGuide guide={guide} status={status} />);
  expect(screen.getByText(status === 'NO_APLICABLE' ? /no hay evidencia que requiera/ : status === 'APROBADO' ? /No es necesario cambiarla/ : /no demuestra un fallo/)).toBeInTheDocument();
});
it('los procedimientos sin bloque corregido no ofrecen una copia vacía', () => {
  render(<PracticalGuide guide={{ ...guide, examples: [{ ...guide.examples[0], corrected: '' }] }} status="HALLAZGO" />); select();
  expect(screen.queryByRole('button', { name: /Copiar/ })).not.toBeInTheDocument();
  expect(screen.getByText('Cómo aplicarlo')).toBeInTheDocument();
});
