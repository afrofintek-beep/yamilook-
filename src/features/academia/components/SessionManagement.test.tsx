import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AcademiaSession } from '../hooks/useAcademia';
const state = vi.hoisted(() => ({ mutate: vi.fn(), pending: false }));
vi.mock('../hooks/useAcademia', () => ({ useManageAcademiaSession: () => ({ mutate: state.mutate, isPending: state.pending }) }));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) => <button onClick={onSelect}>{children}</button>,
}));
import { SessionManagement } from './SessionManagement';
const session = { id: 's', title: 'Teste', status: 'scheduled', scheduledAt: '2099-01-01' } as AcademiaSession;
afterEach(() => { cleanup(); state.mutate.mockReset(); state.pending = false; });
describe('Session management confirmations', () => {
  it('requires a reason before cancellation and sends it with the selected session', () => {
    render(<SessionManagement session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar sessão' }));
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo do cancelamento'), { target: { value: '  Indisponibilidade  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(state.mutate).toHaveBeenCalledWith({ sessionId: 's', action: 'cancel', reason: 'Indisponibilidade' }, expect.any(Object));
  });
  it('allows backing out without mutating and explains deletion restrictions', () => {
    render(<SessionManagement session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByText(/Só é permitido eliminar sessões sem inscrições/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(state.mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('only offers restoration for archived sessions and prevents repeated submission', () => {
    state.pending = true;
    render(<SessionManagement session={{ ...session, archivedAt: '2026-10-27' }} />);
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(screen.getByRole('button', { name: 'A processar…' })).toBeDisabled();
  });
});
