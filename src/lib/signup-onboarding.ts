import { z } from 'zod';
import type { OnboardingDraft } from './onboarding-draft';
import { validAdministrativeAddress } from './angola-administrative';

// Untrusted profile input only, never identity, permissions or certification.
// Strip credentials, photos, precise coordinates and address access codes.
const text = z.string().max(500);
const schema = z.object({
  version: z.literal(1), savedAt: z.number().finite().nonnegative(),
  currentStep: z.number().int().min(0).max(7),
  displayName: text, username: text, email: text, inviteCode: text,
  gender: z.enum(['male', 'female', 'other']).nullable(),
  birthDay: z.string().max(2), birthMonth: z.string().max(2), birthYear: z.string().max(4),
  country: text, city: text, neighborhood: text, customNeighborhood: text, bio: text,
  residenceMethod: z.enum(['home', 'away', 'existing', 'later', 'map']).optional(),
  administrative: z.object({ province: text, municipality: text, commune: text }).optional(),
});
export type SignupOnboarding = z.infer<typeof schema>;

export function createSignupOnboarding(input: Omit<OnboardingDraft, 'version' | 'savedAt'>): SignupOnboarding {
  return schema.parse({ ...input, version: 1, savedAt: Date.now() });
}

export function recoverSignupOnboarding(value: unknown, email?: string): OnboardingDraft | null {
  const parsed = schema.safeParse(value);
  if (!parsed.success || !email || parsed.data.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
  const draft = parsed.data as OnboardingDraft;
  if (draft.administrative && !validAdministrativeAddress(draft.administrative)) delete draft.administrative;
  return draft;
}

type SavedProfile = {
  gender?: string | null; birthday?: string | null; city?: string | null; neighborhood?: string | null;
  onboarding_completed?: boolean;
};
export function resumeOnboardingStep(draft: OnboardingDraft | null, profile?: SavedProfile | null): number {
  if (profile?.onboarding_completed) return 7; // Existing redirect remains authoritative.
  if (!(draft?.gender ?? profile?.gender)) return 0;
  if (!(draft ? draft.birthDay && draft.birthMonth && draft.birthYear : profile?.birthday)) return 1;
  if (!(draft?.city ?? profile?.city) || !(draft?.neighborhood ?? profile?.neighborhood) ||
      (draft?.neighborhood === '__other__' && !draft.customNeighborhood.trim())) return 2;
  // Home GPS and existing-card access are deliberately not persisted. Reconfirm
  // only that step, retaining all other answers and the original address choice.
  if (draft?.residenceMethod === 'map' || draft?.residenceMethod === 'home' || draft?.residenceMethod === 'existing') return 2;
  return draft?.currentStep ?? 2;
}
