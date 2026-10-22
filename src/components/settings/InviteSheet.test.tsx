import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteSheet } from './InviteSheet';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const code = 'A123456789ABCDEF';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: { code }, error: null }); });
const show = () => render(<InviteSheet open onOpenChange={() => {}} />);
const generate = async () => {
  fireEvent.change(screen.getByLabelText('Email da pessoa convidada'), { target: { value: 'new@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gerar código único' }));
  await screen.findByLabelText('Código único de convite');
};
describe('Unique invitations', () => {
  it('issues a code for the recipient and preserves manual copy after clipboard failure', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    show(); await generate();
    expect(rpc).toHaveBeenCalledWith('issue_user_invitation', { p_email: 'new@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('copia manualmente'));
    expect(screen.getByLabelText('Código único de convite')).toHaveValue(code);
    expect(screen.getByLabelText('Link de convite')).toHaveValue(`${window.location.origin}/register?ref=${code}`);
  });
  it('keeps the invitation after cancelling native sharing without canShare', async () => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    show(); await generate();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Partilha cancelada'));
    expect(share).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Código único de convite')).toHaveValue(code);
  });
  it('hides the old invitation when the recipient changes', async () => {
    show(); await generate();
    fireEvent.change(screen.getByLabelText('Email da pessoa convidada'), { target: { value: 'other@example.com' } });
    expect(screen.queryByRole('button', { name: 'Enviar convite' })).not.toBeInTheDocument();
  });
  it('never exposes a code if the server rejects generation', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('Email já registado') });
    show();
    fireEvent.change(screen.getByLabelText('Email da pessoa convidada'), { target: { value: 'old@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar código único' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Email já registado'));
    expect(screen.queryByLabelText('Código único de convite')).not.toBeInTheDocument();
  });
});
