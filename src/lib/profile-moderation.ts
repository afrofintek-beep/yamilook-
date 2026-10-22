import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
export function updateModeratedProfile(target: string, patch: { account_status?: 'active' | 'suspended' | 'banned'; suspended_until?: string | null; suspension_reason?: string | null }) {
  const client = supabase as unknown as { rpc: (name: string, args: { p_target: string; p_patch: Json }) => PromiseLike<{ error: { message: string } | null }> };
  return client.rpc('update_profile_moderation', { p_target: target, p_patch: patch });
}
