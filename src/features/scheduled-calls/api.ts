import { uiText } from '@/i18n/ui-copy';
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
 get request_conflict() { return uiText("Este pedido já foi guardado com outros dados. Fecha e volta a abrir para editar o agendamento."); },
 get unauthenticated() { return uiText("Inicia sessão novamente."); },get not_allowed() { return uiText("Não tens acesso a este agendamento."); },
 get invalid_date() { return uiText("Escolhe uma data e hora futuras."); },get invalid_title() { return uiText("Introduz um título até 120 caracteres e uma descrição até 2000."); },
 get invalid_timezone() { return uiText("O fuso horário não é válido."); },get invalid_call() { return uiText("Verifica o tipo e a duração da chamada."); },
 get invalid_recurrence() { return uiText("Escolhe entre 1 e 52 ocorrências."); },get invalid_dst_time() { return uiText("Uma ocorrência coincide com a mudança de hora. Escolhe outra hora."); },
 get contact_required() { return uiText("Só podes convidar pessoas dos teus contactos."); },get too_many_invitees() { return uiText("Podes convidar até 31 pessoas."); },
 get organizer_required() { return uiText("Só o organizador pode alterar uma chamada ainda não iniciada."); },
 get stale_revision() { return uiText("O agendamento foi alterado noutro dispositivo. Fecha e volta a abrir antes de editar."); },
 get invalid_rsvp() { return uiText("Já não é possível responder a este convite."); },get schedule_limit() { return uiText("Atingiste o limite de 200 agendamentos futuros."); },
};
export async function scheduledAction<T>(action:string,id:string|null=null,payload:object={}):Promise<T>{
 const {data,error}=await supabase.rpc('scheduled_call_action' as never,{p_action:action,p_id:id,p_payload:payload} as never);
 if(error)throw new Error(messages[error.message]||uiText("Não foi possível concluir. Verifica a ligação e tenta novamente."));
 if(data===null)throw new Error(uiText("O servidor não confirmou a operação."));
 return data as T;
}
export function inviteUrl(id:string,origin=window.location.origin,pathname=window.location.pathname){
 return `${origin}${pathname.startsWith('/papos-app')?'/papos-app':''}/scheduled-call/${encodeURIComponent(id)}`;
}
export async function copyInvitation(id:string){await navigator.clipboard.writeText(inviteUrl(id));}
export async function shareInvitation(call:ScheduledCall){
 const data={title:call.title,text:uiText("Convite para uma chamada KOSOLOLA. Acesso reservado aos participantes convidados."),url:inviteUrl(call.id)};
 if(navigator.share)await navigator.share(data);else await navigator.clipboard.writeText(data.url);
}
