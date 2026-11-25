import { supabase } from '@/integrations/supabase/client';
import { adminAreaKeys, type AdminArea } from './catalog';
export type AdminAreaAccess = { userId: string; admin: boolean; areas: Record<AdminArea, boolean> };
export async function getAdminAreaAccess(signal?: AbortSignal): Promise<AdminAreaAccess> {
  const request = supabase.rpc('admin_area_status' as never, {} as never);
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  const result = data as unknown as AdminAreaAccess | null;
  if (error || !result || typeof result.userId !== 'string' || typeof result.admin !== 'boolean'
    || !result.areas || adminAreaKeys.some(key => typeof result.areas[key] !== 'boolean')) {
    throw new Error('admin_area_access_unavailable');
  }
  return result;
}
