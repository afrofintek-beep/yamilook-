import { supabase } from '@/integrations/supabase/client';

export const phoneAccessEnabled = import.meta.env.VITE_PHONE_ACCESS_ENABLED === 'true';

export function normalizePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const international = /^9\d{8}$/.test(compact) ? `+244${compact}`
    : compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
}

export async function requestPhoneCode(phone: string, mode: 'login' | 'link') {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error('invalid_phone');
  const result = mode === 'link'
    ? await supabase.auth.updateUser({ phone: normalized })
    : await supabase.auth.signInWithOtp({ phone: normalized, options: { shouldCreateUser: false } });
  if (result.error) throw result.error;
  return normalized;
}

export async function confirmPhoneCode(phone: string, token: string, mode: 'login' | 'link') {
  if (!/^\d{6}$/.test(token)) throw new Error('invalid_code');
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: mode === 'link' ? 'phone_change' : 'sms' });
  if (error) throw error;
  return data;
}

export async function phoneDirectory(action: 'status' | 'consent' | 'search', input: { enabled?: boolean; phone?: string } = {}) {
  const { data, error } = await supabase.functions.invoke('phone-directory', { body: { action, ...input } });
  if (error || !data?.ok) throw new Error('phone_directory_unavailable');
  return data;
}
