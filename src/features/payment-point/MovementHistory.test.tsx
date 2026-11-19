import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { MovementHistory, groupMovements } from './MovementHistory';
import type { Overview } from './api';
const overview = {
  orders: [{ id: 'order-reference', description: 'Bolo de aniversário', status: 'paid' }],
  entries: [
    { id: 1, amount: -2000, operation: 'payment', reference: 'order-reference', created_at: '2026-11-19T10:00:00Z' },
    { id: 2, amount: -1000, operation: 'payment', reference: 'order-reference', created_at: '2026-11-19T10:00:00Z' },
    { id: 3, amount: 5000, operation: 'topup', reference: 'topup-reference', created_at: '2026-11-19T11:00:00Z' },
    { id: 4, amount: -1000, operation: 'reserve', reference: 'withdraw-reference', created_at: '2026-11-19T12:00:00Z' },
  ],
} as Overview;
afterEach(cleanup);
it('combines payment funding entries and excludes internal reservation movements', () => {
  const result = groupMovements(overview.entries);
  expect(result).toHaveLength(2);
  expect(result.find(entry => entry.operation === 'payment')?.amount).toBe(-3000);
});
it('filters incoming movements and reveals references only in detail', () => {
  render(<MemoryRouter><MovementHistory overview={overview} hidden={false} withdrawals={() => <p>Levantamentos</p>} /></MemoryRouter>);
  expect(screen.queryByText('order-reference')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Entradas' }));
  expect(screen.queryByText('Bolo de aniversário')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Saídas' }));
  fireEvent.click(screen.getByRole('button', { name: /Bolo de aniversário/ }));
  expect(screen.getByText('order-reference')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Partilhar comprovativo' })).toBeInTheDocument();
});
it('requests only pending withdrawals in the pending filter', () => {
  const withdrawals = vi.fn(() => <p>Pedidos em curso</p>);
  render(<MemoryRouter><MovementHistory overview={overview} hidden={false} withdrawals={withdrawals} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Pendentes' }));
  expect(withdrawals).toHaveBeenCalledWith(true);
});
