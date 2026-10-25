import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { scheduledAction, type ScheduledCall, type ScheduleInput } from './api';
export function useScheduledCalls(){
 const {user}=useAuth();const cache=useQueryClient();
 const query=useQuery({queryKey:['scheduled-calls',user?.id],enabled:!!user,queryFn:()=>scheduledAction<ScheduledCall[]>('list'),refetchInterval:15000,refetchOnWindowFocus:true});
 const mutate=async<T,>(action:string,id:string|null,payload:object={})=>{
  if(!user)throw new Error('Inicia sessão novamente.');
  const data=await scheduledAction<T>(action,id,payload);
  await cache.invalidateQueries({queryKey:['scheduled-calls']});
  await cache.invalidateQueries({queryKey:['scheduled-detail']});
  return data;
 };
 return {...query,scheduledCalls:query.data||[],
  save:(payload:ScheduleInput,id?:string)=>mutate<{id:string}>(id?'edit':'create',id||null,payload),
  rsvp:(id:string,status:string)=>mutate('rsvp',id,{status}),
  cancel:(id:string,series=false)=>mutate('cancel',id,{series}),
 };
}
