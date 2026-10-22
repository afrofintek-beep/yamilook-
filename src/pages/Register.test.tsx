import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, it } from 'vitest';
import Register from './Register';
function Destination() { const location = useLocation(); return <p>{location.pathname}{location.search}</p>; }
it('sends invitation registration into the unified wizard without losing the code', async () => {
  render(<MemoryRouter initialEntries={['/register?ref=ABC12345']}><Routes>
    <Route path="/register" element={<Register />} />
    <Route path="/onboarding" element={<Destination />} />
  </Routes></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('/onboarding?ref=ABC12345')).toBeInTheDocument());
});
