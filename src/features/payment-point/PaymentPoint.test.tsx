import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import PaymentPoint from './PaymentPoint';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('./RequestPayment', () => ({ RequestPayment: () => <p>Criar pedido</p> }));
vi.mock('./ScanPayment', () => ({ ScanPayment: () => <p>Scanner aberto</p> }));
vi.mock('./api', async importOriginal => ({
  ...await importOriginal<typeof import('./api')>(),
  paymentAction: vi.fn().mockResolvedValue({
    mode: 'sandbox', admin: true,
    wallet: { purchased: 1000000, earned: 0, reserved: 0 },
    orders: [], entries: [],
    withdrawals: [{ id: 'withdrawal', user_id: 'other', amount: 10000, destination: 'Conta de outro utilizador', status: 'pending' }],
  }),
}));
afterEach(cleanup);
function renderWallet() {
  render(<MemoryRouter initialEntries={['/payment-point']}><Routes>
    <Route path="/payment-point" element={<PaymentPoint />} />
    <Route path="/feed" element={<p>Feed Yamilook</p>} />
  </Routes></MemoryRouter>);
}
it('provides a working exit for direct links and all four wallet actions', async () => {
  renderWallet();
  await screen.findByText('Disponível para pagar');
  for (const name of ['Pagar', 'Receber', 'Carregar', 'Levantar']) expect(screen.getByRole('button', { name })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar valores' }));
  expect(screen.getAllByText('•••• Kz').length).toBe(3);
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
  expect(screen.getByText('Feed Yamilook')).toBeInTheDocument();
});
it('keeps other users withdrawal management in the management view', async () => {
  renderWallet();
  await screen.findByText('Disponível para pagar');
  expect(screen.queryByText('Conta de outro utilizador')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Movimentos' }));
  expect(screen.queryByText('Conta de outro utilizador')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Gestão' }));
  expect(screen.getByText('Conta de outro utilizador')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Iniciar processamento' })).toBeEnabled();
});
