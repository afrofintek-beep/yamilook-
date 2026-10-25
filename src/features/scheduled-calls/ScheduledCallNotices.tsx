import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { scheduledAction } from './api';
interface Notice {id:string;call_id:string;kind:string;title:string}
export function ScheduledCallNotices(){
 const location=useLocation();
 const {user}=useAuth();const cache=useQueryClient();const [error,setError]=useState('');
 const {data=[]}=useQuery({queryKey:['scheduled-notices',user?.id],enabled:!!user,queryFn:()=>scheduledAction<Notice[]>('events'),refetchInterval:30000,refetchOnWindowFocus:true});
 const notice=data[0];if(!notice || location.pathname.includes('/scheduled-call/'))return null;
 const label:Record<string,string>={invited:'Convite para chamada',updated:'Agendamento alterado',cancelled:'Agendamento cancelado',reminder:'A chamada começa dentro de 15 minutos'};
 return <aside aria-label="Avisos de chamadas" className="fixed z-[90] bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 rounded-xl border bg-background p-3 shadow-lg space-y-2">
  <p className="text-sm break-words">{label[notice.kind]}: <strong>{notice.title}</strong>{data.length>1&&` (+${data.length-1})`}</p>
  {error&&<p role="alert">{error}</p>}
  <div className="flex gap-2"><Button asChild size="sm"><Link to={notice.kind==='cancelled'?'/calls':`/scheduled-call/${notice.call_id}`}>Ver</Link></Button><Button size="sm" variant="outline" onClick={async()=>{try{await scheduledAction('ack',notice.id);setError('');await cache.invalidateQueries({queryKey:['scheduled-notices']});}catch{setError('Não foi possível marcar como lido.');}}}>Marcar como lido</Button></div>
 </aside>;
}
