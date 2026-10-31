import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import MentorProfileScreen from './MentorProfileScreen';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === 'mentor-profile'
      ? { id: 'mentor-123', name: 'Estanislau Baptista', isVerifiedMentor: true }
      : [],
    isLoading: false,
  }),
}));
afterEach(cleanup);

it.each(['Abrir perfil de Estanislau Baptista', 'Estanislau Baptista', 'Ver perfil na Yamilook'])(
  'opens the correct public profile using %s', (name) => {
    render(<MemoryRouter initialEntries={['/academia/mentor/mentor-123']}><Routes>
      <Route path="/academia/mentor/:mentorId" element={<MentorProfileScreen />} />
      <Route path="/profile/:userId" element={<p>Perfil completo de Estanislau</p>} />
    </Routes></MemoryRouter>);
    const link = screen.getByRole('link', { name, exact: true });
    expect(link).toHaveAttribute('href', '/profile/mentor-123');
    fireEvent.click(link);
    expect(screen.getByText('Perfil completo de Estanislau')).toBeVisible();
  },
);
