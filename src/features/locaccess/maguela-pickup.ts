import {supabase} from '@/integrations/supabase/client';
export type MaguelaPickupResult={status:'ready'|'designated'|'cleared'|'denied';reference?:string;expiresAt?:string};
export async function maguelaPickup(action:'set'|'clear'|'owner_status'|'resolve',data:Record<string,unknown>):Promise<MaguelaPickupResult>{
 const {data:result,error}=await supabase.rpc('locaccess_maguela_pickup' as never,{p_action:action,p_data:data} as never);
 if(error)throw new Error('Não foi possível verificar a autorização MAGUELA.');
 return result as MaguelaPickupResult;
}
export const validPickupReference=(value:string)=>/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
