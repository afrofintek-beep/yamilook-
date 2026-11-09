import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AfrolocAddressDialog } from './AfrolocAddressDialog';
import { AfrolocAddressCard } from './AfrolocAddressCard';
import { parseChatAfroloc } from '@/lib/chat-afroloc';
afterEach(cleanup);

it('adds a draft without GPS or sending, then renders the recipient NJILA link', () => {
  const onAdd = vi.fn(), onClose = vi.fn();
  const { unmount } = render(<AfrolocAddressDialog onAdd={onAdd} onClose={onClose} />);
  expect(screen.getByRole('button', { name: 'Adicionar à mensagem' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Nome do local'), { target: { value: 'Loja' } });
  fireEvent.change(screen.getByLabelText('Código AFROLOC'), { target: { value: 'AO-LU-example' } });
  expect(onAdd).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar à mensagem' }));
  expect(onAdd).toHaveBeenCalledWith('Loja\n📍 https://www.njilamaps.com/?to=AO-LU-example');
  expect(onClose).toHaveBeenCalledOnce();
  const address = parseChatAfroloc(onAdd.mock.calls[0][0])!;
  unmount();
  const { container } = render(<AfrolocAddressCard address={address} />);
  expect(screen.getByText('Loja')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Abrir no NJILA' })).toHaveAttribute('href', 'https://www.njilamaps.com/?to=AO-LU-example');
  expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
  expect(screen.getByRole('link')).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(container.querySelector('iframe, img')).toBeNull();
});

it('blocks sharing while disabled and closes without adding on cancellation', () => {
  const onAdd = vi.fn(), onClose = vi.fn();
  render(<AfrolocAddressDialog disabled onAdd={onAdd} onClose={onClose} />);
  fireEvent.change(screen.getByLabelText('Código AFROLOC'), { target: { value: 'AO-LU-example' } });
  expect(screen.getByRole('button', { name: 'Adicionar à mensagem' })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(onAdd).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});
