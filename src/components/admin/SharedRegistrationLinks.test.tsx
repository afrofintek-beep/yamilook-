import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SharedRegistrationLinks } from './SharedRegistrationLinks';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const link = { id: 'test-link', code: '1234567890ABCDEF', name: 'LinkedIn', max_uses: 21,
  uses_count: 4, confirmed_count: 2, status: 'active', expires_at: '2099-01-01T00:00:00Z' };
afterEach(cleanup);
beforeEach(() => rpc.mockReset().mockResolvedValue({ data: [link], error: null }));

it('shows registrations separately from confirmations and suspends through the server', async () => {
  render(<SharedRegistrationLinks />);
  await screen.findByText('Inscrições: 4 de 21 · Emails confirmados: 2');
  expect(screen.getByLabelText('Link de convite')).toHaveValue('https://www.yamilook.com/register?ref=1234567890ABCDEF');
  rpc.mockResolvedValueOnce({ data: [{ ...link, status: 'suspended' }], error: null });
  fireEvent.click(screen.getByRole('button', { name: 'Suspender' }));
  await screen.findByRole('button', { name: 'Retomar' });
  expect(rpc).toHaveBeenLastCalledWith('admin_registration_links', { p_link: 'test-link', p_status: 'suspended' });
});

it('does not claim suspension when the server rejects the change', async () => {
  render(<SharedRegistrationLinks />);
  await screen.findByText('LinkedIn');
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
  fireEvent.click(screen.getByRole('button', { name: 'Suspender' }));
  await screen.findByRole('alert');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Suspender' })).toBeEnabled());
  expect(screen.queryByRole('button', { name: 'Retomar' })).not.toBeInTheDocument();
});

it('does not offer to revive expired or full invitations', async () => {
  rpc.mockResolvedValueOnce({ data: [{ ...link, status: 'suspended', uses_count: 21 }], error: null });
  render(<SharedRegistrationLinks />);
  await screen.findByText('Limite atingido');
  expect(screen.getByRole('button', { name: 'Retomar' })).toBeDisabled();
});
