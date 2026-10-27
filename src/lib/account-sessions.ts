import { supabase } from '@/integrations/supabase/client';

export interface AccountSession {
  id: string;
  device_label: string;
  platform: string;
  browser: string;
  app_surface: string;
  first_seen: string;
  last_seen: string;
  is_current: boolean;
}
export interface AccountLoginAlert {
  id: string;
  device_label: string;
  app_surface: string;
  occurred_at: string;
  unread: boolean;
}

/** Typed after the SQL migration lands; never forward credentials or session tokens. */
export async function accountRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const client = supabase as unknown as {
    rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function deviceDescriptor(userAgent: string, pathname: string) {
  const platform = /iPhone|iPad|iPod/i.test(userAgent) ? 'iOS'
    : /Android/i.test(userAgent) ? 'Android'
    : /Windows/i.test(userAgent) ? 'Windows'
    : /Mac/i.test(userAgent) ? 'macOS' : /Linux/i.test(userAgent) ? 'Linux' : 'Web';
  const browser = /Edg\//i.test(userAgent) ? 'Edge'
    : /Firefox|FxiOS/i.test(userAgent) ? 'Firefox'
    : /Chrome|CriOS/i.test(userAgent) ? 'Chrome'
    : /Safari/i.test(userAgent) ? 'Safari' : 'Browser';
  const app_surface = /^\/papos-app(?:\/|$)/.test(pathname) ? 'kosolola' : 'yamilook';
  const device_label = `${platform} · ${browser}`;
  return { p_label: device_label, p_platform: platform, p_browser: browser, p_surface: app_surface };
}

export async function registerCurrentSession(userAgent: string, pathname: string): Promise<void> {
  await accountRpc<boolean>('account_register_session', deviceDescriptor(userAgent, pathname));
}
export async function listAccountSessions(): Promise<AccountSession[]> {
  return (await accountRpc<AccountSession[]>('account_list_sessions')) ?? [];
}
export async function revokeAccountSession(id: string): Promise<void> {
  await accountRpc<boolean>('account_revoke_session', { p_session_id: id });
}
export async function listLoginAlerts(): Promise<AccountLoginAlert[]> {
  return (await accountRpc<AccountLoginAlert[]>('account_list_login_alerts')) ?? [];
}
export async function acknowledgeLoginAlerts(ids: string[]): Promise<void> {
  if (ids.length) await accountRpc<number>('account_acknowledge_login_alerts', { p_alert_ids: ids });
}

/** Only terminate on an explicit invalid/revoked session response. Network
 * failures and pending DB migrations must not log out the user. */
export function isRevokedSessionError(error: { code?: string; status?: number } | null | undefined): boolean {
  return error?.code === '28000' || error?.code === 'PGRST301';
}
