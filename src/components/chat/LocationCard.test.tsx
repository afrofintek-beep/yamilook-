import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { LocationCard } from './LocationCard';
afterEach(cleanup);
it('shows a reference and safe map and directions links without loading external maps', () => {
  const { container } = render(<LocationCard location={{ latitude: -8.93, longitude: 13.18, caption: 'Escritório · portão azul' }} />);
  expect(screen.getByText('Escritório · portão azul')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Como chegar' })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=-8.93,13.18');
  expect(screen.getByRole('link', { name: 'Abrir mapa' })).toHaveAttribute('rel', 'noopener noreferrer');
  expect(container.querySelector('iframe, img')).toBeNull();
});
