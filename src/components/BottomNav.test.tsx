import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from './BottomNav';
afterEach(cleanup);
it('anchors navigation to body outside transformed and scrollable page containers', () => {
  const { container } = render(<MemoryRouter initialEntries={['/muxi']}>
    <div style={{ transform: 'translateX(0)', overflowY: 'auto' }}><BottomNav /></div>
  </MemoryRouter>);
  const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
  expect(nav.parentElement).toBe(document.body);
  expect(container).not.toContainElement(nav);
  expect(nav).toHaveClass('fixed', 'bottom-0', 'left-0', 'right-0');
  expect(screen.getByRole('link', { name: 'Muxi' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getAllByRole('link')).toHaveLength(5);
});
