import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignInvites } from './CampaignInvites';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const campaign = { id: 'c1', name: 'Piloto', status: 'active', eligible: true, starts_at: '2020-01-01', ends_at: '2099-01-01', max_per_user: 10, max_total: 100, my_issued: 0, total_issued: 0 };
const report = { issued: 0, used: 0, pending: 0, expired: 0, invitations: [] };
afterEach(cleanup);
beforeEach(() => rpc.mockReset().mockImplementation((name: string) => Promise.resolve({ data: name === 'list_invitation_campaigns' ? [campaign] : name === 'campaign_report' ? report : { code: 'A123456789ABCDEF', expires_at: '2030-01-02T12:00:00Z' }, error: null })));
async function choose() {
  render(<CampaignInvites />);
  await screen.findByRole('option', { name: 'Piloto — Ativa' });
  fireEvent.change(screen.getByLabelText('Campanha'), { target: { value: 'c1' } });
}
describe('campaign invitations', () => {
  it.each([{ eligible: false }, { status: 'suspended' }, { my_issued: 10 }, { total_issued: 100 }, { ends_at: '2020-01-01' }])('blocks emission when unavailable: %s', async patch => {
    rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'list_invitation_campaigns' ? [{ ...campaign, ...patch }] : report, error: null }));
    render(<CampaignInvites />); await screen.findByRole('option', { name: /Piloto/ });
    fireEvent.change(screen.getByLabelText('Campanha'), { target: { value: 'c1' } });
    expect(screen.getByRole('button', { name: 'Emitir convite da campanha' })).toBeDisabled();
    expect(rpc).not.toHaveBeenCalledWith('issue_campaign_invitation', expect.anything());
  });
  it('retries an uncertain request with the same ID and uses actual expiry in messages', async () => {
    let attempt = 0;
    rpc.mockImplementation((name: string) => Promise.resolve(name === 'issue_campaign_invitation' && ++attempt === 1
      ? { data: null, error: { code: 'NETWORK', message: 'unknown' } }
      : { data: name === 'list_invitation_campaigns' ? [campaign] : name === 'campaign_report' ? report : { code: 'A123456789ABCDEF', expires_at: '2030-01-02T12:00:00Z' }, error: null }));
    await choose();
    fireEvent.click(screen.getByRole('button', { name: 'Emitir convite da campanha' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Emitir convite da campanha' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Emitir convite da campanha' }));
    await screen.findByLabelText('Ligação individual');
    const calls = rpc.mock.calls.filter(([name]) => name === 'issue_campaign_invitation');
    expect(calls).toHaveLength(2); expect(calls[0][1]).toEqual(calls[1][1]);
    const message = new URL(screen.getByRole('link', { name: 'Partilhar no WhatsApp' }).getAttribute('href')!).searchParams.get('text');
    expect(message).toContain('Válido até'); expect(message).not.toContain('durante 7 dias');
  });
  it('does not expose a token when the server denies a stale quota', async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(name === 'issue_campaign_invitation'
      ? { data: null, error: { code: 'P0001', message: 'Limite pessoal de convites atingido.' } }
      : { data: name === 'list_invitation_campaigns' ? [campaign] : report, error: null }));
    await choose(); fireEvent.click(screen.getByRole('button', { name: 'Emitir convite da campanha' }));
    await screen.findByText('Limite pessoal de convites atingido.');
    expect(screen.queryByLabelText('Ligação individual')).not.toBeInTheDocument();
  });
  it('prevents simultaneous clicks from creating multiple requests', async () => {
    let resolve!: (value: unknown) => void;
    rpc.mockImplementation((name: string) => name === 'issue_campaign_invitation' ? new Promise(r => { resolve = r; })
      : Promise.resolve({ data: name === 'list_invitation_campaigns' ? [campaign] : report, error: null }));
    await choose(); const button = screen.getByRole('button', { name: 'Emitir convite da campanha' });
    fireEvent.click(button); fireEvent.click(button);
    expect(rpc.mock.calls.filter(([name]) => name === 'issue_campaign_invitation')).toHaveLength(1);
    await act(async () => resolve({ data: { code: 'A123456789ABCDEF', expires_at: '2030-01-02' }, error: null }));
  });
});
