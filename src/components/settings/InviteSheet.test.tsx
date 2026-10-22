import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteSheet } from './InviteSheet';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'inviter' } }) }));
const code = 'A123456789ABCDEF';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { rpc.mockReset(); rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'can_issue_user_invitation' ? true : { code }, error: null })); });
const show = () => render(<InviteSheet open onOpenChange={() => {}} />);
const generate = async () => {
  fireEvent.change(await screen.findByLabelText('Email da pessoa convidada'), { target: { value: 'new@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gerar código único' }));
  await screen.findByLabelText('Código único de convite');
};
describe('Unique invitations', () => {
  it('lets the administrator grant and revoke invitation permission', async () => {
    let authorized = false;
    rpc.mockImplementation((name: string, args: { p_allowed?: boolean }) => {
      if (name === 'set_invitation_permission') authorized = !!args.p_allowed;
      return Promise.resolve({ data: name === 'list_invitation_permissions' ? (authorized ? [{ email: 'delegate@example.com', granted_at: '' }] : []) : true, error: null });
    });
    render(<InviteSheet open isAdmin onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Email do utilizador'), { target: { value: 'delegate@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar convites' }));
    await screen.findByText('delegate@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Retirar autorização' }));
    await waitFor(() => expect(screen.queryByText('delegate@example.com')).not.toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith('set_invitation_permission', { p_email: 'delegate@example.com', p_allowed: false });
  });
  it('blocks generation for a user without authorization', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    show();
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('can_issue_user_invitation', { p_user_id: 'inviter' }));
    expect(screen.queryByRole('button', { name: 'Gerar código único' })).not.toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalledWith('issue_user_invitation', expect.anything());
  });
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
    fireEvent.change(await screen.findByLabelText('Email da pessoa convidada'), { target: { value: 'other@example.com' } });
    expect(screen.queryByRole('button', { name: 'Enviar convite' })).not.toBeInTheDocument();
  });
  it('never exposes a code if the server rejects generation', async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(name === 'can_issue_user_invitation' ? { data: true, error: null } : { data: null, error: new Error('Email já registado') }));
    show();
    fireEvent.change(await screen.findByLabelText('Email da pessoa convidada'), { target: { value: 'old@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar código único' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Email já registado'));
    expect(screen.queryByLabelText('Código único de convite')).not.toBeInTheDocument();
  });
});
