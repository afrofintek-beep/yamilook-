import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InvitationCampaignAdmin } from './InvitationCampaignAdmin';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
afterEach(cleanup);
beforeEach(() => rpc.mockReset().mockImplementation((name: string) => Promise.resolve({ data: name === 'list_invitation_campaigns' ? [] : name === 'save_invitation_campaign' ? 'c1' : null, error: null })));
it('creates only a draft without authorizing any users', async () => {
  render(<InvitationCampaignAdmin />);
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Piloto' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Criar rascunho' }).closest('form')!);
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('save_invitation_campaign', expect.objectContaining({ p_id: null, p_config: expect.objectContaining({ status: 'draft', max_per_user: 10 }) })));
  expect(rpc).not.toHaveBeenCalledWith('set_campaign_member', expect.anything());
});
it('requires an explicit presence attestation before authorizing', async () => {
  const campaign = { id: 'c1', name: 'Piloto', status: 'active', starts_at: '2020-01-01', ends_at: '2099-01-01', max_per_user: 10, max_total: 100, min_account_days: 7, active_within_days: 30, invite_ttl_hours: 168, require_confirmed_email: true };
  rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'list_invitation_campaigns' ? [campaign] : null, error: null }));
  render(<InvitationCampaignAdmin />); await screen.findByRole('option', { name: 'Piloto — Ativa' });
  fireEvent.change(screen.getByLabelText('Campanha a gerir'), { target: { value: 'c1' } });
  expect(screen.getByRole('button', { name: 'Autorizar nesta campanha' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Confirmei a presença verificada deste participante.'));
  expect(screen.getByRole('button', { name: 'Autorizar nesta campanha' })).toBeEnabled();
  expect(rpc).not.toHaveBeenCalledWith('set_campaign_member', expect.anything());
});
