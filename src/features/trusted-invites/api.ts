import { supabase } from '@/integrations/supabase/client';
import { getYamilookPublicUrl } from '@/lib/public-site';

const TRUSTED_INVITE_TOKEN_PATTERN = /^[a-zA-Z0-9_-]{32,256}$/;

export type TrustedInviteMode = 'direct' | 'phone';
export type TrustedInviteLanguage = 'pt' | 'en' | 'fr';
export type TrustedInvitation = {
  id: string;
  recipient_name: string;
  inviter_name?: string | null;
  mode: TrustedInviteMode;
  masked_phone?: string | null;
  language: TrustedInviteLanguage;
  expires_at: string;
  created_at: string;
  status: string;
  used_at?: string | null;
  revoked_at?: string | null;
};
export type TrustedInvitationPreview = Pick<TrustedInvitation, 'recipient_name' | 'mode' | 'masked_phone' | 'language' | 'expires_at' | 'status'> & {
  inviter_name: string;
};
export type TrustedActivation = {
  session: { access_token: string; refresh_token: string } | null;
  account_created: true;
  username: string;
  recovery_code: string;
};

export class TrustedInvitationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'TrustedInvitationError';
  }
}

type ResponseBody = { ok?: boolean; error?: { code?: string; message?: string } };

export async function trustedInvitationRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('trusted-invitations', { body: { action, ...payload } });
  let body = data as ResponseBody | null;
  if (error && !body) {
    const response = (error as { context?: Response }).context;
    if (response && typeof response.clone === 'function') {
      try { body = await response.clone().json(); } catch { /* Use a stable local message. */ }
    }
  }
  if (error || !body || body.ok !== true) {
    throw new TrustedInvitationError(body?.error?.code || 'unavailable', body?.error?.message || 'Não foi possível concluir o pedido.');
  }
  return body as T;
}

export function trustedInviteLanguage(language: string): TrustedInviteLanguage {
  const base = language.toLowerCase().split('-')[0];
  return base === 'en' || base === 'fr' ? base : 'pt';
}

export function readTrustedInvitationToken(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('trusted')?.trim() || '';
  return TRUSTED_INVITE_TOKEN_PATTERN.test(token) ? token : null;
}

export function readTrustedInvitationInput(input: string): string | null {
  const value = input.trim();
  if (TRUSTED_INVITE_TOKEN_PATTERN.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/^\/(?:convite-confianca|register)\/?$/.test(url.pathname)) return null;
    return readTrustedInvitationToken(url.hash);
  } catch {
    return null;
  }
}

export function buildTrustedInviteUrl(token: string, language: TrustedInviteLanguage): string {
  if (!TRUSTED_INVITE_TOKEN_PATTERN.test(token)) throw new Error('invalid_invitation_token');
  const url = new URL(getYamilookPublicUrl('/convite-confianca'));
  url.searchParams.set('lang', language);
  url.hash = new URLSearchParams({ trusted: token }).toString();
  return url.toString();
}

export function invitationState(invitation: Pick<TrustedInvitation, 'status' | 'expires_at' | 'used_at' | 'revoked_at'>): string {
  if (invitation.used_at || invitation.status === 'used') return 'used';
  if (invitation.revoked_at || invitation.status === 'revoked') return 'revoked';
  if (Date.parse(invitation.expires_at) <= Date.now() || invitation.status === 'expired') return 'expired';
  return invitation.status === 'pending' || invitation.status === 'active' ? 'pending' : invitation.status;
}
