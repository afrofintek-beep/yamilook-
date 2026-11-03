import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n, { changeAppLanguage } from '@/i18n';
import { appLanguages } from '@/i18n/afroloc-languages';
import Onboarding from './Onboarding';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({
  user: null, profile: null, loading: false, updateProfile: vi.fn(), signUp: vi.fn(), refreshProfile: vi.fn(),
}) }));
vi.mock('@/lib/onboarding-draft', () => ({ loadOnboardingDraft: () => null, saveOnboardingDraft: () => true, clearOnboardingDraft: vi.fn() }));

afterEach(async () => { cleanup(); await act(async () => { await changeAppLanguage('pt'); }); });
describe('language before registration', () => {
  it('keeps the registration step when the language changes midway', async () => {
    await changeAppLanguage('fr');
    render(<MemoryRouter initialEntries={['/onboarding?invite=single-use-code']}><Onboarding /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Masculin/ }));
    expect(await screen.findByRole('heading', { name: i18n.t('onboardingFlow.birthday') })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: /Choisissez/ }), { target: { value: 'sw' } });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ulizaliwa lini?' })).toBeInTheDocument());
    expect(screen.getByText(i18n.t('onboardingFlow.step', { current: 2, total: 8 }))).toBeInTheDocument();
  });
  for (const { code } of appLanguages) {
    it(`renders the first registration step in ${code}`, async () => {
      await changeAppLanguage(code);
      render(<MemoryRouter initialEntries={['/onboarding?invite=test-code']}><Onboarding /></MemoryRouter>);
      expect(await screen.findByRole('heading', { name: i18n.t('onboardingFlow.identity') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: new RegExp(i18n.t('onboardingFlow.male')) })).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(10);
      expect(screen.getByText(i18n.t('onboardingFlow.required'))).toBeInTheDocument();
    });
  }
});
