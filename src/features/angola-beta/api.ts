import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
type BetaDatabase = Omit<Database, 'public'> & { public: Omit<Database['public'], 'Functions'> & { Functions: Database['public']['Functions'] & {
  angola_beta: { Args: { p_action: string; p_payload: Json }; Returns: Json };
} } };
export type BetaStatus = { confirmed: number; capacity: number; available: number; open: boolean; starts_at: string; ends_at: string; banda_invite?: boolean; valid?: boolean };
export type BandaInvite = { code: string; slot: number; used: boolean; confirmed: boolean };
export type BetaReport = { enabled: boolean; capacity: number; registered: number; confirmed: number; daily_active: number; weekly_active: number; online: number; invites_used: number; waitlist: number; ends_at: string; feedback: { id: string; message: string; created_at: string }[] };
export async function betaAction<T>(action: string, payload: Json = {}): Promise<T> {
 const { data, error } = await (supabase as unknown as SupabaseClient<BetaDatabase>).rpc('angola_beta', { p_action: action, p_payload: payload });
 if (error) throw new Error(error.code === 'P0001' ? error.message : 'Não foi possível consultar a campanha. Tenta novamente.');
 return data as T;
}
