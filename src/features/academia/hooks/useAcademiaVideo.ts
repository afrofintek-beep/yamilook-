import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, ConnectionState, Participant, RemoteParticipant } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';

export async function requestAcademiaVideo(sessionId: string, action: 'join'|'start'|'end') {
  let { data: { session } } = await supabase.auth.getSession();
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 10000) {
    session = (await supabase.auth.refreshSession()).data.session;
  }
  if (!session) throw new Error('Inicia sessão novamente.');
  const { data, error } = await supabase.functions.invoke('academia-video', {
    headers: { Authorization: `Bearer ${session.access_token}` }, body: { sessionId, action },
  });
  if (error) {
    let reason = '';
    try { reason = (await error.context?.json())?.error || ''; } catch { /* network error */ }
    const messages: Record<string,string> = {
      reservation_required: 'Reserva um lugar para entrar nesta sessão.',
      not_live: 'Aguarda que o mentor inicie a sessão.',
      mentor_required: 'Apenas o mentor pode iniciar ou encerrar a sessão.',
      too_early: 'A sala abre 15 minutos antes da hora marcada.',
      session_closed: 'Esta sessão já foi encerrada.',
      room_close_failed: 'A sessão foi encerrada. Não foi possível confirmar o fecho da ligação; tenta novamente.',
    };
    throw new Error(messages[reason] || 'Não foi possível ligar à sala de vídeo. Tenta novamente.');
  }
  if (!data || data.error) throw new Error('Não foi possível obter acesso à sala.');
  return data as {token:string;url:string;isMentor:boolean};
}

export interface AcademiaChatMessage { id: string; name: string; text: string }
export function useAcademiaVideo(sessionId: string | undefined) {
  const ref = useRef<Room | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const [room,setRoom] = useState<Room|null>(null);
  const [participants,setParticipants] = useState<Participant[]>([]);
  const [connection,setConnection] = useState(ConnectionState.Disconnected);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [messages,setMessages] = useState<AcademiaChatMessage[]>([]);
  const [audioBlocked,setAudioBlocked] = useState(false);
  const leave = useCallback(() => {
    generation.current++;
    const current=ref.current;
    ref.current=null;
    current?.disconnect();
    setRoom(null); setParticipants([]); setConnection(ConnectionState.Disconnected); setLoading(false);
  },[]);
  useEffect(() => {
    leave();
    return () => { generation.current++; ref.current?.disconnect(); ref.current=null; };
  },[sessionId,leave]);

  const join = async (isMentor:boolean, camera:boolean, microphone:boolean) => {
    if (!sessionId || busy.current || ref.current) return;
    busy.current=true; setLoading(true); setError(''); setMessages([]);
    const run=++generation.current;
    const active=() => run===generation.current;
    let next:Room|null=null;
    try {
      const credentials=await requestAcademiaVideo(sessionId,isMentor?'start':'join');
      if (!active()) return;
      next=new Room({adaptiveStream:true,dynacast:true,videoCaptureDefaults:{resolution:{width:640,height:360,frameRate:24}}});
      const r=next;
      ref.current=r;
      const sync=() => { if (active()) setParticipants([r.localParticipant,...r.remoteParticipants.values()]); };
      for (const event of [RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,RoomEvent.TrackSubscribed,RoomEvent.TrackUnsubscribed,RoomEvent.TrackMuted,RoomEvent.TrackUnmuted,RoomEvent.LocalTrackPublished,RoomEvent.LocalTrackUnpublished]) r.on(event,sync);
      r.on(RoomEvent.ConnectionStateChanged,state=>{if(active())setConnection(state);});
      r.on(RoomEvent.Disconnected,()=>{if(active()){ref.current=null;setRoom(null);setParticipants([]);}});
      r.on(RoomEvent.AudioPlaybackStatusChanged,()=>{if(active())setAudioBlocked(!r.canPlaybackAudio);});
      r.on(RoomEvent.DataReceived,(data:Uint8Array,p?:RemoteParticipant,_kind?:unknown,topic?:string)=>{
        if (!active() || !p || topic!=='academia-chat' || data.byteLength>4096) return;
        try {
          const payload=JSON.parse(new TextDecoder().decode(data));
          if(typeof payload.text!=='string' || !payload.text.trim())return;
          setMessages(items=>[...items,{id:crypto.randomUUID(),name:p.name||'Participante',text:payload.text.slice(0,1000)}].slice(-100));
        } catch { /* ignore malformed chat packets */ }
      });
      await r.connect(credentials.url,credentials.token);
      if(!active()){await r.disconnect();return;}
      setRoom(r);sync();
      // A permission refusal leaves the participant connected in listening mode.
      try {
        if(camera) await r.localParticipant.setCameraEnabled(true);
        if(!active()){await r.disconnect();return;}
        if(microphone) await r.localParticipant.setMicrophoneEnabled(true);
      } catch { if(active())setError('Ligado sem câmara ou microfone. Autoriza o acesso nas definições do navegador e tenta ativar novamente.'); }
      if(!active()){await r.disconnect();return;}
      await r.startAudio().catch(()=>{});
      setAudioBlocked(!r.canPlaybackAudio);sync();
    } catch (e) {
      if(active()) {
        await next?.disconnect();ref.current=null;setRoom(null);setParticipants([]);
        setError(e instanceof Error ? e.message : 'Não foi possível entrar. Confirma a reserva e a ligação à internet.');
      }
    } finally {busy.current=false;if(active())setLoading(false);}
  };
  const toggle = async (kind:'camera'|'microphone') => {
    const r=ref.current;if(!r)return;
    try {
      if(kind==='camera')await r.localParticipant.setCameraEnabled(!r.localParticipant.isCameraEnabled);
      else await r.localParticipant.setMicrophoneEnabled(!r.localParticipant.isMicrophoneEnabled);
      setParticipants([r.localParticipant,...r.remoteParticipants.values()]);setError('');
    }catch{setError('Não foi possível ativar o dispositivo. Verifica as permissões da câmara e do microfone.');}
  };
  const send = async (text:string) => {
    const r=ref.current;const message=text.trim().slice(0,1000);if(!r||!message)return false;
    try {
      await r.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({text:message})),{reliable:true,topic:'academia-chat'});
      setMessages(items=>[...items,{id:crypto.randomUUID(),name:'Tu',text:message}].slice(-100));return true;
    }catch{setError('Não foi possível enviar a mensagem.');return false;}
  };
  return {room,participants,connection,loading,error,messages,audioBlocked,join,leave,toggle,send};
}
