import { supabase } from '@/integrations/supabase/client';
import { getYamilookPublicUrl } from '@/lib/public-site';

export const FAIR_SLUG = 'natal-solidario-talatona-2026';
export const FAIR_PATH = '/feira-natalicia-talatona';
export const socialInitiativesEnabled = import.meta.env.VITE_SOCIAL_INITIATIVES_ENABLED === 'true';
export interface InitiativeCatalog {
  name: string;
  goal_invites: number;
  require_attendance: boolean;
  status: 'draft' | 'active' | 'suspended' | 'closed';
  starts_at: string | null;
  ends_at: string | null;
  capacity: number | null;
  condominiums: { id: string; name: string; area: string }[];
}
export interface SocialRegistration {
  user_id: string;
  condominium_id: string | null;
  other_condominium: string | null;
  afroloc_code: string;
  approved_at: string | null;
  valid_until: string | null;
  verified_condominium: string | null;
  proximity_group: string | null;
  evidence_reference: string | null;
  attended_at: string | null;
  is_public: boolean;
}
export interface Participation {
  registration: SocialRegistration | null;
  address_valid: boolean;
  completed_invites: number;
  awarded: boolean;
  invitations: { code: string; expires_at: string; used: boolean; completed: boolean }[];
}
export interface InitiativeReport {
  registrations: (SocialRegistration & { display_name: string; username: string; address_valid: boolean; completed_invites: number })[];
  total: number;
}
export interface ProfileInitiatives {
  initiatives: { slug: string; name: string; awarded: boolean; awarded_at: string | null; registered_at: string; is_public: boolean }[];
}
export async function socialAction<T>(action: string, payload: Record<string, unknown> = {}, slug = FAIR_SLUG): Promise<T> {
  const { data, error } = await supabase.functions.invoke('social-initiatives', { body: { action, slug, payload } });
  if (error) {
    const response = await error.context?.json?.().catch(() => null);
    throw new Error(response?.error || 'Não foi possível concluir. Tente novamente.');
  }
  if (!data || data.error) throw new Error(data?.error || 'Serviço indisponível.');
  return data as T;
}
export function fairInviteCode(search: string) {
  const value = new URLSearchParams(search).get('convite')?.toUpperCase();
  return value && /^[A-F0-9]{16}$/.test(value) ? value : undefined;
}
export function fairInviteUrl(code: string) {
  return getYamilookPublicUrl(`${FAIR_PATH}?convite=${encodeURIComponent(code)}`);
}
