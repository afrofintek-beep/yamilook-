import {supabase} from '@/integrations/supabase/client';
export type Grant={id:string;username:string;radius:0|100|250|500;expiresAt:string};
export type Policy={handle:string;enabled:boolean;grants:Grant[]};
export const validHandle=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export const accessLink=(handle:string)=>validHandle(handle)?'https://www.yamilook.com/afroloc/acesso/'+handle:'';
export async function locaccess<T=Policy>(action:string,data:Record<string,unknown>):Promise<T>{
 const {data:result,error}=await supabase.rpc('locaccess_action' as never,{p_action:action,p_data:data} as never);
 if(error)throw new Error(error.code==='P0001'?error.message:error.code==='42501'?'Volta a entrar na Yamilook.':'Não foi possível actualizar o acesso. Tenta novamente.');
 return result as T;
}
