import { render, screen } from '@testing-library/react';
import Home from './page';

it('muestra la página inicial', () => {
  render(<Home />);
  expect(screen.getByRole('heading', { name: 'NexoGuard' })).toBeInTheDocument();
});
