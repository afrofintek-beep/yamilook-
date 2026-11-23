import { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { TrustedInvitationError, trustedInvitationRequest } from '@/features/trusted-invites/api';

const usernamePattern = /^@?[a-z0-9][a-z0-9_]{2,19}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isTrustedUsername(value: string): boolean {
  return usernamePattern.test(value.trim());
}

export function normalizeTrustedUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function isValidLoginIdentifier(value: string): boolean {
  return isTrustedUsername(value) || emailPattern.test(value.trim());
}

export function isTrustedPasswordValid(value: string): boolean {
  const bytes = new TextEncoder().encode(value).length;
  return Array.from(value).length >= 12 && bytes <= 72 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value);
}

/** Keep ordinary e-mail sign-in on the existing native Auth path. */
export async function signInWithIdentifier(identifier: string, password: string): Promise<{ error: AuthError | null }> {
  if (!isTrustedUsername(identifier)) {
    const { error } = await supabase.auth.signInWithPassword({ email: identifier, password });
    return { error };
  }

  try {
    const result = await trustedInvitationRequest<{
      session?: { access_token?: string; refresh_token?: string };
    }>('login', { username: normalizeTrustedUsername(identifier), password });
    const session = result.session;
    if (!session?.access_token || !session.refresh_token) {
      return { error: new AuthError('Unable to sign in', 503, 'unavailable') };
    }
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    return { error };
  } catch (error) {
    const code = error instanceof TrustedInvitationError ? error.code : 'unavailable';
    const credentialsError = code === 'invalid_credentials' || code === 'invalid_username';
    return { error: new AuthError(
      credentialsError ? 'Invalid login credentials' : 'Unable to sign in',
      code === 'rate_limited' ? 429 : credentialsError ? 400 : 503,
      credentialsError ? 'invalid_credentials' : code,
    ) };
  }
}

export function normalizeRecoveryCode(value: string): string {
  return value.replace(/[\s-]+/g, '').toLowerCase();
}

export function isRecoveryCodeValid(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(normalizeRecoveryCode(value));
}

export async function recoverTrustedAccount(username: string, recoveryCode: string, password: string): Promise<{ recovery_code: string; username: string }> {
  if (!isTrustedUsername(username) || !isRecoveryCodeValid(recoveryCode)) {
    throw new TrustedInvitationError('invalid_recovery', 'Recovery details are invalid.');
  }
  if (!isTrustedPasswordValid(password)) {
    throw new TrustedInvitationError('weak_password', 'Password does not meet the requirements.');
  }
  const result = await trustedInvitationRequest<{ recovery_code?: string; username?: string }>('recover', {
    username: normalizeTrustedUsername(username),
    recovery_code: normalizeRecoveryCode(recoveryCode),
    new_password: password,
  });
  if (!result.recovery_code || !isRecoveryCodeValid(result.recovery_code)) {
    throw new TrustedInvitationError('unavailable', 'The recovery response could not be verified.');
  }
  return { recovery_code: result.recovery_code, username: result.username || normalizeTrustedUsername(username) };
}
