import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FileApplicationPicker from './FileApplicationPicker';
afterEach(cleanup);
it('keeps the requested order and opens native sharing only on an explicit action', () => {
  const share = vi.fn();
  render(<FileApplicationPicker onShare={share} />);
  expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Kosolola','WhatsApp','LinkedIn','TikTok','YouTube','Facebook','Instagram','Outros']);
  fireEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));
  expect(share).not.toHaveBeenCalled();
  expect(screen.getByRole('note')).toHaveTextContent('Se não aparecer');
  fireEvent.click(screen.getByRole('button', { name: 'Abrir opções do telemóvel' }));
  expect(share).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Outros' }));
  expect(share).toHaveBeenCalledTimes(2);
});
it('does not silently replace a prepared file with a public link for Kosolola', () => {
  const share = vi.fn();
  render(<FileApplicationPicker onShare={share} />);
  fireEvent.click(screen.getByRole('button', { name: 'Kosolola' }));
  expect(screen.getByRole('note')).toHaveTextContent('Guarda a cópia com marca');
  expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.kosolola.com');
  expect(share).not.toHaveBeenCalled();
});
