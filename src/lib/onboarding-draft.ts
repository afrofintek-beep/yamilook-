const KEY = 'yamilook_onboarding_draft_v1';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export interface OnboardingDraft {
  version: 1;
  savedAt: number;
  currentStep: number;
  displayName: string;
  username: string;
  email: string;
  inviteCode: string;
  gender: 'male' | 'female' | 'other' | null;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  country: string;
  city: string;
  neighborhood: string;
  customNeighborhood: string;
  bio: string;
  residenceMethod?: 'home' | 'away' | 'existing' | 'later';
}
type DraftInput = Omit<OnboardingDraft, 'version' | 'savedAt'>;
// Explicit allowlist: passwords, session tokens, photos and GPS never enter storage.
const keyFor = (email?: string) => email ? `${KEY}:${email.trim().toLowerCase()}` : KEY;
export function saveOnboardingDraft(input: DraftInput, accountEmail?: string): boolean {
  const draft: OnboardingDraft = {
    version: 1, savedAt: Date.now(), currentStep: input.currentStep,
    displayName: input.displayName, username: input.username, email: input.email,
    inviteCode: input.inviteCode, gender: input.gender, birthDay: input.birthDay,
    birthMonth: input.birthMonth, birthYear: input.birthYear, country: input.country,
    city: input.city, neighborhood: input.neighborhood,
    customNeighborhood: input.customNeighborhood, bio: input.bio,
    residenceMethod: ['home','away','existing','later'].includes(input.residenceMethod || '') ? input.residenceMethod : 'later',
  };
  try { localStorage.setItem(keyFor(accountEmail), JSON.stringify(draft)); return true; } catch { return false; }
}
export function loadOnboardingDraft(context: { email?: string; inviteCode?: string } = {}): OnboardingDraft | null {
  try {
    const draft = JSON.parse((context.email ? localStorage.getItem(keyFor(context.email)) : null) || localStorage.getItem(KEY) || 'null');
    if (!draft || draft.version !== 1 || typeof draft.savedAt !== 'number' ||
        Date.now() - draft.savedAt > MAX_AGE || draft.savedAt > Date.now() ||
        !Number.isInteger(draft.currentStep) || draft.currentStep < 0 || draft.currentStep > 7) return null;
    const fields = ['displayName','username','email','inviteCode','birthDay','birthMonth','birthYear','country','city','neighborhood','customNeighborhood','bio'];
    if (fields.some(field => typeof draft[field] !== 'string')) return null;
    if (![null, 'male', 'female', 'other'].includes(draft.gender)) return null;
    if (context.email && draft.email.toLowerCase().trim() !== context.email.toLowerCase().trim()) return null;
    if (context.inviteCode && draft.inviteCode.toUpperCase() !== context.inviteCode.toUpperCase()) return null;
    if (draft.residenceMethod && !['home','away','existing','later'].includes(draft.residenceMethod)) return null;
    return draft;
  } catch { return null; }
}
export function clearOnboardingDraft(email?: string): void {
  try {
    if (email) localStorage.removeItem(keyFor(email));
    const guest = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!email || guest?.email?.trim().toLowerCase() === email.trim().toLowerCase()) localStorage.removeItem(KEY);
  } catch { /* Storage may be unavailable. */ }
}
