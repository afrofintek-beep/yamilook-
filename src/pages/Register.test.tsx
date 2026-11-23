import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import Register from './Register';
function Destination() { const location = useLocation(); return <p>{location.pathname}{location.search}</p>; }
it('sends invitation registration into the unified wizard without losing the code', async () => {
  render(<MemoryRouter initialEntries={['/register?ref=ABC12345']}><Routes>
    <Route path="/register" element={<Register />} />
    <Route path="/onboarding" element={<Destination />} />
  </Routes></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('/onboarding?ref=ABC12345')).toBeInTheDocument());
});

it('routes a trusted invitation to its activation screen without exposing the token in the query', async () => {
  const token = 'ab'.repeat(32);
  function TrustedDestination() { const location = useLocation(); return <p>{location.pathname}{location.search}{location.hash}</p>; }
  render(<MemoryRouter initialEntries={['/register?lang=fr#trusted=' + token]}><Routes>
    <Route path="/register" element={<Register />} />
    <Route path="/convite-confianca" element={<TrustedDestination />} />
  </Routes></MemoryRouter>);
  expect(await screen.findByText('/convite-confianca?lang=fr#trusted=' + token)).toBeInTheDocument();
});

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
it('uses the verified campaign title and preserves the single-use code on acceptance', async () => {
  rpc.mockResolvedValue({ data: { valid: true, campaign_name: 'A Banda da Marla' } });
  const query = '?ref=ABCDEF0123456789&lang=pt';
  render(<MemoryRouter initialEntries={['/register' + query]}><Routes>
    <Route path="/register" element={<Register />} />
    <Route path="/onboarding" element={<Destination />} />
  </Routes></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'A Banda da Marla' })).toBeVisible();
  fireEvent.click(screen.getByRole('link', { name: 'Aceitar convite e inscrever-me' }));
  await screen.findByText('/onboarding' + query);
});
