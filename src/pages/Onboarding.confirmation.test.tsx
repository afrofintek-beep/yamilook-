import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@/i18n';
import Onboarding from './Onboarding';
import { createSignupOnboarding } from '@/lib/signup-onboarding';
import { saveOnboardingDraft } from '@/lib/onboarding-draft';

const state = vi.hoisted(() => ({ user: null as any, profile: null as any, signUp: vi.fn(), rpc: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ ...state, loading: false, refreshProfile: vi.fn() }) }));
// Personal signup has no business-registration access; that permission has its own hook tests.
vi.mock('@/hooks/useBusinessRegistrationAccess', () => ({ useBusinessRegistrationAccess: () => ({ data: false, isLoading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: state.rpc, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
} }));
const input = {
  currentStep: 7, displayName: 'Pessoa', username: 'pessoa', email: 'person@example.com',
  inviteCode: 'INVITE', gender: 'female' as const, birthDay: '12', birthMonth: '8',
  birthYear: '1990', country: 'AO', city: 'Luanda', neighborhood: 'Banda', customNeighborhood: '',
  bio: '', residenceMethod: 'later' as const,
};
function mount() {
  render(<MemoryRouter initialEntries={['/onboarding']}><Routes>
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="/profile" element={<p>Existing profile</p>} />
    <Route path="/login" element={<p>Confirm email then sign in</p>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  const data = new Map<string, string>();
  vi.mocked(localStorage.getItem).mockImplementation(key => data.get(key) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => { data.set(key, value); });
  vi.mocked(localStorage.removeItem).mockImplementation(key => { data.delete(key); });
  state.user = null; state.profile = null;
  state.signUp.mockReset(); state.signUp.mockResolvedValue({ error: null });
  state.rpc.mockReset(); state.rpc.mockResolvedValue({ data: { valid: true }, error: null });
});
afterEach(cleanup);
describe('email confirmation continuation', () => {
  it('sends the collected fields with signup even when no session is issued', async () => {
    saveOnboardingDraft(input); mount();
    fireEvent.change(await screen.findByPlaceholderText('••••••••'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar na comunidade/i }));
    await waitFor(() => expect(state.signUp).toHaveBeenCalled());
    expect(state.signUp.mock.calls[0][2].onboarding_draft).toMatchObject(input);
    expect(await screen.findByText('Confirm email then sign in', {}, { timeout: 7000 })).toBeInTheDocument();
  }, 10000);
  it('opens the finish step after confirmation in a fresh browser', async () => {
    state.user = { id: 'one', email: input.email, user_metadata: { onboarding_draft: createSignupOnboarding(input) } };
    state.profile = { display_name: 'Pessoa', onboarding_completed: false };
    mount();
    expect(await screen.findByRole('heading', { name: /Concluir/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('••••••••')).not.toBeInTheDocument();
    expect(state.signUp).not.toHaveBeenCalled();
  });
  it('requires both a photo and nonblank post before publishing', async () => {
    state.user = { id: 'one', email: input.email, user_metadata: { onboarding_draft: createSignupOnboarding(input) } };
    state.profile = { display_name: 'Pessoa', onboarding_completed: false };
    mount();
    const publish = await screen.findByRole('button', { name: /Publicar e concluir/i });
    expect(publish).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello Muxi' } });
    expect(publish).toBeDisabled();
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('allows publishing only with a saved photo and explicit post text', async () => {
    state.user = { id: 'one', email: input.email, user_metadata: { onboarding_draft: createSignupOnboarding(input) } };
    state.profile = { display_name: 'Pessoa', onboarding_completed: false, avatar_url: 'https://example.com/avatar.jpg' };
    mount();
    const publish = await screen.findByRole('button', { name: /Publicar e concluir/i });
    expect(publish).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    expect(publish).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello Muxi' } });
    expect(publish).toBeEnabled();
    expect(screen.getByRole('combobox', { name: /Quem pode ver/ })).toHaveValue('contacts');
  });
  it('leaves completed accounts on their existing profile even with an old draft', async () => {
    state.user = { id: 'one', email: input.email, user_metadata: { onboarding_draft: createSignupOnboarding(input) } };
    state.profile = { onboarding_completed: true };
    mount();
    expect(await screen.findByText('Existing profile')).toBeInTheDocument();
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.signUp).not.toHaveBeenCalled();
  });
});
