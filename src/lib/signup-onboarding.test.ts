import { describe, expect, it } from 'vitest';
import { createSignupOnboarding, recoverSignupOnboarding, resumeOnboardingStep } from './signup-onboarding';
const input = {
  currentStep: 7, displayName: 'Pessoa', username: 'pessoa', email: 'person@example.com',
  inviteCode: 'INVITE', gender: 'female' as const, birthDay: '12', birthMonth: '8',
  birthYear: '1990', country: 'AO', city: 'Luanda', neighborhood: 'Banda', customNeighborhood: '',
  bio: '', residenceMethod: 'later' as const,
};
describe('confirmation across browsers', () => {
  it('recovers all submitted fields from the account without browser storage', () => {
    const draft = recoverSignupOnboarding(JSON.parse(JSON.stringify(createSignupOnboarding(input))), input.email);
    expect(draft).toMatchObject(input);
    expect(resumeOnboardingStep(draft)).toBe(7);
  });
  it('strips secrets and privilege claims and rejects another account or corrupt data', () => {
    const draft = createSignupOnboarding({ ...input, password: 'secret', latitude: 1, role: 'admin', onboarding_completed: true } as typeof input);
    expect(draft).not.toHaveProperty('password');
    expect(draft).not.toHaveProperty('latitude');
    expect(draft).not.toHaveProperty('role');
    expect(draft).not.toHaveProperty('onboarding_completed');
    expect(recoverSignupOnboarding(draft, 'other@example.com')).toBeNull();
    expect(recoverSignupOnboarding({ ...draft, gender: 'invalid' }, input.email)).toBeNull();
  });
  it('reconfirms only residence when GPS or a private card code was not persisted', () => {
    for (const residenceMethod of ['home', 'existing', 'map'] as const) {
      const draft = createSignupOnboarding({ ...input, residenceMethod });
      expect(resumeOnboardingStep(recoverSignupOnboarding(draft, input.email))).toBe(2);
    }
  });
  it('resumes legacy incomplete profiles at the first missing field', () => {
    expect(resumeOnboardingStep(null, {})).toBe(0);
    expect(resumeOnboardingStep(null, { gender: 'male' })).toBe(1);
    expect(resumeOnboardingStep(null, { gender: 'male', birthday: '1990-08-12' })).toBe(2);
    expect(resumeOnboardingStep(null, { onboarding_completed: true })).toBe(7);
  });
});
