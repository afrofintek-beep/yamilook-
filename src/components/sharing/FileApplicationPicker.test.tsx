import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FileApplicationPicker from './FileApplicationPicker';
afterEach(cleanup);
it('keeps the requested order and guides LinkedIn without opening the native sheet', () => {
  const share = vi.fn();
  render(<FileApplicationPicker onShare={share} />);
  expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Kosolola','WhatsApp','LinkedIn','TikTok','YouTube','Facebook','Instagram','Outros']);
  fireEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));
  expect(share).not.toHaveBeenCalled();
  expect(screen.getByRole('region', { name: 'Publicar no LinkedIn' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Abrir opções do telemóvel' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Outros' }));
  expect(share).toHaveBeenCalledTimes(1);
});
it.each(['WhatsApp', 'TikTok', 'YouTube', 'Facebook', 'Instagram', 'Outros'])('opens sharing directly for %s and updates the selected destination', label => {
  const share = vi.fn();
  render(<FileApplicationPicker onShare={share} />);
  fireEvent.click(screen.getByRole('button', { name: label, exact: true }));
  expect(share).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
});
it('offers recovery without calling unsupported file sharing', () => {
  const share = vi.fn();
  render(<FileApplicationPicker onShare={share} nativeShareAvailable={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'YouTube' }));
  expect(share).not.toHaveBeenCalled();
  expect(screen.getByRole('note')).toHaveTextContent('Escolhe YouTube');
  expect(screen.getByRole('status')).toHaveTextContent('não permite enviar ficheiros');
});
it('does not silently replace a prepared file with a public link for Kosolola', () => {
  const share = vi.fn();
  render(<FileApplicationPicker onShare={share} />);
  fireEvent.click(screen.getByRole('button', { name: 'Kosolola' }));
  expect(screen.getByRole('note')).toHaveTextContent('Guarda a cópia com marca');
  expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.kosolola.com');
  expect(share).not.toHaveBeenCalled();
});
