import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { WalletAccessGate } from './WalletAccess';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
afterEach(cleanup);
function renderGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><WalletAccessGate><p>Saldo privado</p></WalletAccessGate></MemoryRouter></QueryClientProvider>);
}
it('blocks a direct link for an account without an invitation', async () => {
  rpc.mockResolvedValue({ data: { allowed: false, admin: false }, error: null });
  renderGate();
  expect(await screen.findByText(/Até ao lançamento/)).toBeInTheDocument();
  expect(screen.queryByText('Saldo privado')).not.toBeInTheDocument();
});
it('opens the wallet for an invited account', async () => {
  rpc.mockResolvedValue({ data: { allowed: true, admin: false }, error: null });
  renderGate();
  expect(await screen.findByText('Saldo privado')).toBeInTheDocument();
});
it('fails closed when verification is unavailable', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
  renderGate();
  expect(await screen.findByText('Não foi possível verificar o acesso.')).toBeInTheDocument();
  expect(screen.queryByText('Saldo privado')).not.toBeInTheDocument();
});
