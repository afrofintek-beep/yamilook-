import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => ({ select: () => ({
  eq: () => ({ limit: async () => ({ data: [{ contact_user_id: 'friend-id' }] }) }),
  in: async () => ({ data: [{ id: 'friend-id', display_name: 'Amiga', username: 'amiga', avatar_url: null }] }),
}) }) } }));
import { JourneyDetailSheet } from './JourneyDetailSheet';
afterEach(cleanup);
it('closes the detail and parent journey before opening the selected friend profile', async () => {
  function Page() {
    const [journeyOpen, setJourneyOpen] = useState(true);
    const [detailOpen, setDetailOpen] = useState(true);
    return <>{journeyOpen && <p>Jornada aberta</p>}
      <JourneyDetailSheet open={detailOpen} onOpenChange={setDetailOpen} onNavigate={() => setJourneyOpen(false)} type="friends" userId="owner" />
    </>;
  }
  render(<MemoryRouter initialEntries={['/profile']}><Page /><Routes>
    <Route path="/profile" element={<p>Perfil próprio</p>} />
    <Route path="/profile/:userId" element={<p>Perfil e Muxi da amiga</p>} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Ver perfil de Amiga' }));
  expect(screen.getByText('Perfil e Muxi da amiga')).toBeVisible();
  expect(screen.queryByText('Jornada aberta')).not.toBeInTheDocument();
});
