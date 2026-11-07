import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignConfig {
  name: string; status: 'draft' | 'active' | 'suspended' | 'closed';
  starts_at: string; ends_at: string; max_per_user: number; max_total: number;
  active_within_days: number; min_account_days: number; require_confirmed_email: boolean; invite_ttl_hours: number;
}
export interface InvitationCampaign extends CampaignConfig {
  id: string; created_at: string; eligible: boolean; my_issued: number; total_issued: number;
}
export interface CampaignInvitation {
  code: string; invited_by: string; recipient_email: string | null; created_at: string;
  expires_at: string; used_at: string | null; state: 'pending' | 'used' | 'expired';
}
export interface CampaignReport {
  issued: number; used: number; expired: number; pending: number;
  invitations: CampaignInvitation[];
  members?: { user_id: string; email: string; eligible: boolean; revoked_at: string | null; verification_reference: string; presence_valid_until: string }[];
  audit?: { id: number; action: string; created_at: string; details: unknown }[];
}
type Rpc = {
  list_invitation_campaigns: { Args: Record<string, never>; Returns: InvitationCampaign[] };
  save_invitation_campaign: { Args: { p_id: string | null; p_config: CampaignConfig }; Returns: string };
  set_campaign_member: { Args: { p_campaign: string; p_email: string; p_allowed: boolean; p_reference: string; p_valid_until: string | null }; Returns: undefined };
  issue_campaign_invitation: { Args: { p_campaign: string; p_request_id: string; p_email: string | null }; Returns: { code: string; expires_at: string } };
  campaign_report: { Args: { p_campaign: string; p_offset: number }; Returns: CampaignReport };
};
export const campaignClient = supabase as unknown as SupabaseClient<{
  public: { Tables: Record<never, never>; Views: Record<never, never>; Functions: Rpc; Enums: Record<never, never>; CompositeTypes: Record<never, never> };
}>;
export function canIssueCampaign(c: InvitationCampaign, now = Date.now()) {
  return c.eligible && c.status === 'active' && Date.parse(c.starts_at) <= now && Date.parse(c.ends_at) > now
    && c.my_issued < c.max_per_user && c.total_issued < c.max_total;
}
export function campaignError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    && 'code' in error && (error.code === 'P0001' || error.code === '42501')) return error.message;
  return 'Não foi possível concluir. Atualiza a campanha e tenta novamente.';
}
export const campaignStateLabels = { draft: 'Rascunho', active: 'Ativa', suspended: 'Suspensa', closed: 'Encerrada' };
