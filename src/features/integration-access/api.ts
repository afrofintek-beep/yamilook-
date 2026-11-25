import { supabase } from '@/integrations/supabase/client';

export type IntegrationFeature = 'google_maps' | 'maguela';
export type IntegrationAccess = {
  userId: string;
  googleMaps: boolean;
  maguela: boolean;
  admin: boolean;
  wallet: boolean;
  businessRegistration: boolean;
};
export type IntegrationGrant = {
  userId: string;
  username: string;
  displayName: string;
  googleMaps: boolean;
  maguela: boolean;
};

async function manage(action: string, userId?: string, feature?: IntegrationFeature, signal?: AbortSignal): Promise<unknown> {
  const request = supabase.rpc('integration_access_manage' as never, {
    p_action: action,
    p_user_id: userId ?? null,
    p_feature: feature ?? null,
  } as never);
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw new Error('integration_access_unavailable');
  return data;
}

export async function getIntegrationAccess(signal?: AbortSignal): Promise<IntegrationAccess> {
  const result = await manage('status', undefined, undefined, signal) as IntegrationAccess | null;
  if (!result || typeof result.userId !== 'string' || typeof result.googleMaps !== 'boolean'
    || typeof result.maguela !== 'boolean' || typeof result.admin !== 'boolean'
    || typeof result.wallet !== 'boolean' || typeof result.businessRegistration !== 'boolean') {
    throw new Error('integration_access_unavailable');
  }
  return result;
}

export async function listIntegrationGrants(): Promise<IntegrationGrant[]> {
  const result = await manage('list');
  if (!Array.isArray(result) || result.some(row => !row || typeof row.userId !== 'string'
    || typeof row.username !== 'string' || typeof row.displayName !== 'string'
    || typeof row.googleMaps !== 'boolean' || typeof row.maguela !== 'boolean')) {
    throw new Error('integration_access_unavailable');
  }
  return result as IntegrationGrant[];
}

export async function setIntegrationGrant(userId: string, feature: IntegrationFeature, enabled: boolean): Promise<void> {
  const result = await manage(enabled ? 'grant' : 'revoke', userId, feature) as { ok?: boolean } | null;
  if (result?.ok !== true) throw new Error('integration_access_unavailable');
}
