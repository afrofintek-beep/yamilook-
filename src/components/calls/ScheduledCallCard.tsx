import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
const ScheduleCallSheet = lazy(() => import('./ScheduleCallSheet').then(m => ({ default: m.ScheduleCallSheet })));
import { useScheduledCalls } from '@/features/scheduled-calls/useScheduledCalls';
import { type ScheduledCall, copyInvitation, shareInvitation } from '@/features/scheduled-calls/api';

export function ScheduledCallCard({call}:{call:ScheduledCall;onJoin?:()=>void;onEdit?:()=>void}){
 const {user}=useAuth();const navigate=useNavigate();const {toast}=useToast();const {rsvp,cancel}=useScheduledCalls();
 const [editing,setEditing]=useState(false);const [busy,setBusy]=useState(false);const [confirm,setConfirm]=useState(false);
 const host=user?.id===call.organizer_id;
 const run=async(task:()=>Promise<unknown>,message:string)=>{
  if(busy)return;setBusy(true);
  try{await task();toast({title:message});setConfirm(false);}
  catch(e){if(e instanceof Error&&e.name==='AbortError')return;toast({title:'Não foi possível concluir',description:e instanceof Error?e.message:'Tenta novamente.',variant:'destructive'});}
  finally{setBusy(false);}
 };
 return <article className="p-4 rounded-2xl border bg-card space-y-3 min-w-0">
  <h3 className="font-semibold break-words">{call.title}</h3>
  {call.description&&<p className="text-sm break-words">{call.description}</p>}
  <p className="text-sm">{new Date(call.scheduled_at).toLocaleString('pt-PT',{dateStyle:'short',timeStyle:'short'})} · {call.duration_minutes} min · {call.call_type==='video'?'Vídeo':'Voz'}</p>
  <p className="text-xs text-muted-foreground">Hora local do dispositivo · Fuso de origem: {call.timezone}</p>
  {call.is_recurring&&<p className="text-xs">Ocorrência de uma série</p>}
  {!host&&call.status==='scheduled'&&<div className="flex flex-wrap gap-2">
   {(['accepted','maybe','declined'] as const).map((status,i)=><Button key={status} disabled={busy} variant="outline" onClick={()=>void run(()=>rsvp(call.id,status),'Resposta guardada')}>{['Aceitar','Talvez','Recusar'][i]}</Button>)}
  </div>}
  <div className="flex flex-wrap gap-2">
   <Button onClick={()=>navigate(`/scheduled-call/${call.id}`)}>Abrir chamada</Button>
   <Button variant="outline" disabled={busy} onClick={()=>void run(()=>copyInvitation(call.id),'Ligação copiada')}>Copiar ligação</Button>
   <Button variant="outline" disabled={busy} onClick={()=>void run(()=>shareInvitation(call),'Convite partilhado ou copiado')}>Partilhar</Button>
   {host&&call.status==='scheduled'&&<><Button variant="outline" onClick={()=>setEditing(true)}>Editar</Button><Button variant="destructive" onClick={()=>setConfirm(true)}>Cancelar</Button></>}
  </div>
  {confirm&&<div role="group" aria-label="Confirmar cancelamento" className="space-y-2 border rounded-xl p-3">
   <p>Cancelar esta chamada?</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>void run(()=>cancel(call.id),'Chamada cancelada')}>Esta ocorrência</Button>
   {call.series_id&&<Button disabled={busy} onClick={()=>void run(()=>cancel(call.id,true),'Ocorrências futuras canceladas')}>Esta e as seguintes</Button>}
   <Button variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Voltar</Button></div>
  </div>}
  {editing && <Suspense fallback={<p role="status">A carregar agendamento…</p>}><ScheduleCallSheet open={editing} onOpenChange={setEditing} existingCall={call}/></Suspense>}
 </article>;
}
