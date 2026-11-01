import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactInviteActions } from './ContactInviteActions';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const invite = { code: 'A123456789ABCDEF', expires_at: '2026-11-08T12:00:00Z' };
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: invite, error: null }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const prepare = async (name = 'Convidar pelo WhatsApp') => {
  fireEvent.click(screen.getByRole('button', { name }));
  await screen.findByLabelText('Ligação para o teu contacto');
};
describe('device contact invitations', () => {
  it('issues without email and opens WhatsApp with a unique link', async () => {
    render(<ContactInviteActions />);
    expect(rpc).not.toHaveBeenCalled();
    await prepare();
    expect(rpc).toHaveBeenCalledWith('issue_shareable_user_invitation', { p_request_id: expect.any(String) });
    const url = new URL(screen.getByRole('link', { name: 'Escolher contacto no WhatsApp' }).getAttribute('href')!);
    expect(url.searchParams.get('text')).toContain('/register?ref=' + invite.code);
    expect(url.searchParams.get('text')).not.toContain('undefined');
    expect(screen.queryByRole('textbox', { name: /email/i })).not.toBeInTheDocument();
  });
  it('opens an email draft with recipient empty for selection in Mail', async () => {
    render(<ContactInviteActions />); await prepare('Convidar por email');
    const link = screen.getByRole('link', { name: 'Escolher contacto no email' });
    expect(link).toHaveAttribute('href', expect.stringMatching(/^mailto:\?subject=/));
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('Indica o teu email ao registar-te');
  });
  it('reuses the request ID on retry and creates a new one for another contact', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('network') });
    render(<ContactInviteActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Convidar pelo WhatsApp' }));
    await screen.findByText(/Não foi possível preparar/);
    const first = rpc.mock.calls[0][1].p_request_id;
    await prepare();
    expect(rpc.mock.calls[1][1].p_request_id).toBe(first);
    fireEvent.click(screen.getByRole('button', { name: 'Convidar outra pessoa' }));
    await prepare();
    expect(rpc.mock.calls[2][1].p_request_id).not.toBe(first);
  });
  it('disables duplicate creation during the request', async () => {
    rpc.mockReturnValue(new Promise(() => {}));
    render(<ContactInviteActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Convidar pelo WhatsApp' }));
    expect(screen.getByRole('button', { name: 'Convidar por email' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Convidar pelo WhatsApp' }));
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('invokes native sharing only on a fresh click and handles cancellation', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    vi.stubGlobal('navigator', { share });
    render(<ContactInviteActions />); await prepare();
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Partilhar pelo telemóvel' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining(invite.code) })));
    expect(screen.queryByText(/Partilha concluída/)).not.toBeInTheDocument();
  });
  it('keeps a selectable link when clipboard access fails', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<ContactInviteActions />); await prepare('Criar ligação de convite');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar ligação' }));
    await screen.findByText(/copia manualmente/);
    expect(screen.getByLabelText('Ligação para o teu contacto')).toHaveValue('https://www.yamilook.com/register?ref=' + invite.code);
  });
});
