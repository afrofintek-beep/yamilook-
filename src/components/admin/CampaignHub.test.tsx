import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { CampaignHub } from './CampaignHub';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/lib/invitation-campaigns', () => ({ campaignClient: { rpc } }));
vi.mock('./TrustedInvitesPanel', () => ({ TrustedInvitesPanel: () => <h3 id="convites-confianca">Painel de convites de confiança</h3> }));

it('opens and scrolls to the trusted invitation panel from its admin deep link', async () => {
  const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
  render(<MemoryRouter initialEntries={['/admin#convites-confianca']}><CampaignHub /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Painel de convites de confiança' })).toBeVisible();
  await waitFor(() => expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }));
});
