import { supabase } from '@/integrations/supabase/client';
export interface ScheduledCall {
 id:string; organizer_id:string; title:string; description:string|null; call_type:'voice'|'video';
 scheduled_at:string; duration_minutes:number; timezone:string; is_recurring:boolean;
 recurrence_pattern:string|null; invite_link:string|null; waiting_room_enabled:boolean; status:string;
 series_id?:string|null; revision:number;
}
export interface Invitee {user_id:string;display_name:string|null;rsvp_status:string;waiting:boolean}
export interface ScheduleInput {
 title:string;description?:string;scheduled_at:string;timezone:string;duration_minutes:number;
 call_type:'voice'|'video';recurrence_pattern?:string;occurrences:number;waiting_room_enabled:boolean;invitees:string[];
 request_id?:string;revision?:number;
}
const messages:Record<string,string>={
 request_conflict:'Este pedido já foi guardado com outros dados. Fecha e volta a abrir para editar o agendamento.',
 unauthenticated:'Inicia sessão novamente.',not_allowed:'Não tens acesso a este agendamento.',
 invalid_date:'Escolhe uma data e hora futuras.',invalid_title:'Introduz um título até 120 caracteres e uma descrição até 2000.',
 invalid_timezone:'O fuso horário não é válido.',invalid_call:'Verifica o tipo e a duração da chamada.',
 invalid_recurrence:'Escolhe entre 1 e 52 ocorrências.',invalid_dst_time:'Uma ocorrência coincide com a mudança de hora. Escolhe outra hora.',
 contact_required:'Só podes convidar pessoas dos teus contactos.',too_many_invitees:'Podes convidar até 31 pessoas.',
 organizer_required:'Só o organizador pode alterar uma chamada ainda não iniciada.',
 stale_revision:'O agendamento foi alterado noutro dispositivo. Fecha e volta a abrir antes de editar.',
 invalid_rsvp:'Já não é possível responder a este convite.',schedule_limit:'Atingiste o limite de 200 agendamentos futuros.',
};
export async function scheduledAction<T>(action:string,id:string|null=null,payload:object={}):Promise<T>{
 const {data,error}=await supabase.rpc('scheduled_call_action' as never,{p_action:action,p_id:id,p_payload:payload} as never);
 if(error)throw new Error(messages[error.message]||'Não foi possível concluir. Verifica a ligação e tenta novamente.');
 if(data===null)throw new Error('O servidor não confirmou a operação.');
 return data as T;
}
export function inviteUrl(id:string,origin=window.location.origin,pathname=window.location.pathname){
 return `${origin}${pathname.startsWith('/papos-app')?'/papos-app':''}/scheduled-call/${encodeURIComponent(id)}`;
}
export async function copyInvitation(id:string){await navigator.clipboard.writeText(inviteUrl(id));}
export async function shareInvitation(call:ScheduledCall){
 const data={title:call.title,text:'Convite para uma chamada KOSOLOLA. Acesso reservado aos participantes convidados.',url:inviteUrl(call.id)};
 if(navigator.share)await navigator.share(data);else await navigator.clipboard.writeText(data.url);
}
