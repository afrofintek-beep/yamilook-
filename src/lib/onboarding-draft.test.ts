import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft } from './onboarding-draft';
const draft = {
  currentStep: 7, displayName: 'Convidada', username: 'convidada', email: 'new@example.com',
  inviteCode: 'ABCD1234', gender: 'female' as const, birthDay: '12', birthMonth: '8',
  birthYear: '1990', country: 'AO', city: 'Luanda', neighborhood: 'Banda', customNeighborhood: '', bio: 'Olá',
};
beforeEach(() => {
  vi.restoreAllMocks();
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => { data.clear(); },
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('onboarding recovery', () => {
  it('restores the step and required fields after the email-confirmation handoff', () => {
    expect(saveOnboardingDraft(draft)).toBe(true);
    expect(loadOnboardingDraft({ email: draft.email })).toMatchObject(draft);
  });
  it('never serializes credentials, photos or precise coordinates', () => {
    saveOnboardingDraft({ ...draft, password: 'Secret123', token: 'token', latitude: 1, avatarFile: 'photo' } as typeof draft);
    const text = localStorage.getItem('yamilook_onboarding_draft_v1')!;
    expect(text).not.toMatch(/password|Secret123|token|latitude|avatarFile/);
  });
  it('rejects another invitation or another account', () => {
    saveOnboardingDraft(draft);
    expect(loadOnboardingDraft({ email: 'other@example.com' })).toBeNull();
    expect(loadOnboardingDraft({ inviteCode: 'OTHER1234' })).toBeNull();
  });
  it('keeps authenticated drafts isolated from guest registration and other accounts', () => {
    saveOnboardingDraft(draft, draft.email);
    expect(loadOnboardingDraft()).toBeNull();
    expect(loadOnboardingDraft({ email: draft.email })).toMatchObject(draft);
    expect(loadOnboardingDraft({ email: 'other@example.com' })).toBeNull();
  });
  it('expires old drafts and handles corrupt or unavailable storage', () => {
    saveOnboardingDraft(draft);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(loadOnboardingDraft()).toBeNull();
    localStorage.setItem('yamilook_onboarding_draft_v1', '{broken');
    expect(loadOnboardingDraft()).toBeNull();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(saveOnboardingDraft(draft)).toBe(false);
  });
  it('clears both guest and account progress on completion', () => {
    saveOnboardingDraft(draft); saveOnboardingDraft(draft, draft.email);
    clearOnboardingDraft(draft.email);
    expect(loadOnboardingDraft({ email: draft.email })).toBeNull();
  });
});
