import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { CampaignHub } from './CampaignHub';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/lib/invitation-campaigns', () => ({ campaignClient: { rpc } }));
vi.mock('@/features/admin-areas/useAdminAreas', () => ({ useAdminAreas: () => ({ allowed: { admin_trusted_invites: true } }) }));
it('opens the dedicated trusted invitation route from campaigns', async () => {
  render(<MemoryRouter initialEntries={['/admin/campanhas']}><Routes>
    <Route path="/admin/campanhas" element={<CampaignHub />} />
    <Route path="/admin/convites-confianca" element={<h1>Painel de convites de confiança</h1>} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Convites de confiança' }));
  expect(await screen.findByRole('heading', { name: 'Painel de convites de confiança' })).toBeVisible();
});
