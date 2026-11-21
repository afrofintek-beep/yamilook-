import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { MentionText } from './MentionText';

it('separates business mentions from personal handles with the same name', () => {
  render(<MemoryRouter><MentionText text="Loja @negocio/mercado e pessoa @mercado." /></MemoryRouter>);
  expect(screen.getByRole('link', { name: '@negocio/mercado' })).toHaveAttribute('href', '/negocio/mercado');
  expect(screen.getByRole('link', { name: '@mercado' })).toHaveAttribute('href', '/u/mercado');
});
