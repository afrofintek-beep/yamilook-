import { Suspense, useEffect } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { PaposCallLayout } from './PaposApp';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
const mocks = vi.hoisted(() => ({ release: vi.fn() }));
vi.mock('@/components/calls/ActiveCallProvider', () => ({ ActiveCallProvider: ({ children }: { children: React.ReactNode }) => {
  useEffect(() => () => mocks.release(), []);
  return <><p>Chamada ativa</p><Link to="/contacts">Contactos teste</Link>{children}</>;
} }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });
it('preserves the call transport through a page crash, retry, and navigation', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let broken = true;
  function Calls() { if (broken) throw new Error('bad history'); return <p>Histórico recuperado</p>; }
  render(<MemoryRouter initialEntries={['/calls']}><Suspense fallback="loading"><Routes>
    <Route element={<PaposCallLayout />}>
      <Route path="/calls" element={<Calls />} />
      <Route path="/contacts" element={<p>Contactos disponíveis</p>} />
    </Route>
  </Routes></Suspense></MemoryRouter>);
  await screen.findByText('Não foi possível abrir esta página');
  expect(screen.getByText('Chamada ativa')).toBeVisible();
  expect(mocks.release).not.toHaveBeenCalled();
  broken = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(screen.getByText('Histórico recuperado')).toBeVisible();
  fireEvent.click(screen.getByText('Contactos teste'));
  expect(screen.getByText('Contactos disponíveis')).toBeVisible();
  expect(mocks.release).not.toHaveBeenCalled();
});
