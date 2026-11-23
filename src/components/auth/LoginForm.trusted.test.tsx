import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginForm } from './LoginForm';

const mocks = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ signIn: mocks.signIn }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, functions: {} } }));
vi.mock('@/features/phone-access/PhoneAccess', () => ({ PhoneAccess: () => null }));
vi.mock('./SocialLoginButtons', () => ({ SocialLoginButtons: () => null }));
vi.mock('@/i18n/ui-copy', () => ({ useUiLocale: () => 'pt', uiText: (text: string) => text }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => { vi.clearAllMocks(); mocks.signIn.mockResolvedValue({ error: null }); });
afterEach(() => cleanup());

it('accepts an invited user’s username in the existing login form', async () => {
  render(<MemoryRouter initialEntries={['/login']}><Routes>
    <Route path="/login" element={<LoginForm />} />
    <Route path="/feed" element={<p>A tua comunidade</p>} />
  </Routes></MemoryRouter>);
  const identifier = screen.getByLabelText('E-mail ou nome de utilizador');
  expect(identifier).toHaveAttribute('type', 'text');
  expect(identifier).toHaveAttribute('autoComplete', 'username');
  fireEvent.change(identifier, { target: { value: ' @Tony_Silva ' } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'PrivatePassword123' } });
  fireEvent.click(screen.getByRole('button', { name: /entrar no yamilook/i }));
  await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith('@Tony_Silva', 'PrivatePassword123'));
  expect(await screen.findByText('A tua comunidade')).toBeInTheDocument();
});
