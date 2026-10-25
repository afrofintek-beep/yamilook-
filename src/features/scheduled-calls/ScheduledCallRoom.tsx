import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Track, Participant, ConnectionState } from 'livekit-client';
import { ArrowLeft, Camera, Mic, PhoneOff, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { scheduledAction, type ScheduledCall, type Invitee } from './api';
import { ScheduleCallSheet } from '@/components/calls/ScheduleCallSheet';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { VideoTrack } from '@/components/live/VideoTrack';
import { AudioTrack } from '@/components/live/AudioTrack';
import { EmptyStateBack } from '@/components/common/EmptyStateBack';
import { requestScheduledVideo, useScheduledVideo } from './useScheduledVideo';

function ParticipantTile({participant,local}:{participant:Participant;local:boolean}) {
  const camera=participant.getTrackPublication(Track.Source.Camera);
  const microphone=participant.getTrackPublication(Track.Source.Microphone);
  return <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-border">
    {camera?.track && !camera.isMuted ? <VideoTrack track={camera.track} muted className="w-full h-full object-contain" /> : <div className="h-full grid place-items-center text-muted-foreground">Câmara desligada</div>}
    {!local && microphone?.track && !microphone.isMuted && <AudioTrack track={microphone.track} />}
    <div className="absolute bottom-1 left-2 right-2 flex justify-between gap-2 text-xs text-white bg-black/60 rounded px-2 py-1">
      <span className="truncate">{participant.name || 'Participante'}{local?' (tu)':''}</span><span>{microphone?.isMuted===false?'Microfone ligado':'Sem microfone'}</span>
    </div>
  </div>;
}
export default function ScheduledCallRoom() {
  const {sessionId}=useParams<{sessionId:string}>();
  const navigate=useNavigate();const {user}=useAuth();
  const video=useScheduledVideo(sessionId);
  const [camera,setCamera]=useState(false);const [microphone,setMicrophone]=useState(false);
  const [editing,setEditing]=useState(false);
  const [text,setText]=useState('');const [ending,setEnding]=useState(false);const [endError,setEndError]=useState('');
  const {data:session,isLoading,error,refetch,dataUpdatedAt}=useQuery({
    queryKey:['scheduled-detail',sessionId,user?.id],enabled:!!sessionId,refetchInterval:5000,
    queryFn:()=>scheduledAction<ScheduledCall & {invitees:Invitee[]}>('detail',sessionId!),
  });
  const isHost=!!user && session?.organizer_id===user.id;
  const opensAt=new Date(new Date(session?.scheduled_at || '').getTime()-15*60*1000);
  const tooEarly=isHost && session?.status==='scheduled' && opensAt.getTime()>Math.max(Date.now(),dataUpdatedAt);
  const closed=!!session && (['completed','cancelled'].includes(session.status)||new Date(session.scheduled_at).getTime()+session.duration_minutes*60000<Math.max(Date.now(),dataUpdatedAt));
  useEffect(()=>{if(closed)video.leave();},[closed,video.leave]);
  const exit=()=>{video.leave();navigate('/calls',{replace:true});};
  const end=async()=>{
    if(!sessionId||ending)return;setEnding(true);setEndError('');
    try{await requestScheduledVideo(sessionId,'end');video.leave();await refetch();}
    catch(e){setEndError(e instanceof Error?e.message:'Não foi possível encerrar.');}
    finally{setEnding(false);}
  };
  if(isLoading)return <div className="h-screen-safe bg-background grid place-items-center">A carregar sessão…</div>;
  if(error)return <EmptyStateBack message="Não foi possível carregar a sessão." fallbackRoute="/calls" />;
  if(!session)return <EmptyStateBack message="Sessão não encontrada." fallbackRoute="/calls" />;
  return <main className="fixed inset-0 h-screen-safe overflow-hidden flex flex-col bg-background">
    <header className="shrink-0 safe-top border-b border-border bg-background"><div className="h-14 px-3 flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label="Sair da sala" onClick={exit}><ArrowLeft /></Button>
      <h1 className="min-w-0 flex-1 truncate font-semibold">{session.title}</h1>
      <span className="text-xs shrink-0">{closed?'Encerrada':video.connection===ConnectionState.Connected?'Ligado':video.connection===ConnectionState.Reconnecting?'A religar…':'Chamada agendada'}</span>
    </div></header>
    <section className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
      {(video.error||endError) && <p role="alert" className="rounded-xl border border-destructive p-3 text-sm">{endError||video.error}{video.error.includes('Inicia sessão novamente') && <Button className="mt-3 block" onClick={async()=>{video.leave();await supabase.auth.signOut({scope:'local'});navigate('/login');}}>Entrar novamente</Button>}</p>}
      {closed ? <div className="space-y-3"><p>A sessão foi encerrada.</p><Button onClick={exit}>Voltar às chamadas</Button></div> : !video.room ? <div className="max-w-lg mx-auto space-y-5">
        <h2 className="text-lg font-semibold">{isHost?'Iniciar chamada':'Entrar na chamada'}</h2>
        <p className="text-sm text-muted-foreground">{isHost?(tooEarly?`Esta sala abre em ${opensAt.toLocaleString('pt-AO',{dateStyle:'short',timeStyle:'short'})}. Podes entrar 15 minutos antes da hora marcada.`:'Podes abrir a sala 15 minutos antes da hora marcada.'):'A entrada está disponível após o organizador iniciar a sessão, para quem tem um convite.'}</p>
        <label className="flex items-center gap-3"><input disabled={session.call_type==='voice'} type="checkbox" checked={camera} onChange={e=>setCamera(e.target.checked)} />Entrar com câmara</label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={microphone} onChange={e=>setMicrophone(e.target.checked)} />Entrar com microfone</label>
        <Button className="w-full" disabled={video.loading||tooEarly||(!isHost&&session.status!=='started')} onClick={()=>void video.join(isHost,session.call_type==='video'&&camera,microphone)}>{video.loading?'A ligar…':isHost?'Iniciar / entrar':'Entrar na sala'}</Button>
      </div> : <>
        {video.audioBlocked && <Button className="w-full" onClick={()=>void video.room?.startAudio()}><Volume2 className="mr-2 h-4 w-4" />Ativar som</Button>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{video.participants.map(p=><ParticipantTile key={p.identity} participant={p} local={p===video.room?.localParticipant} />)}</div>
        <p className="text-sm text-muted-foreground">{video.participants.length} participante(s) ligado(s)</p>
        <section aria-label="Chat da sessão" className="border border-border rounded-xl p-3 space-y-3">
          <h2 className="font-semibold">Chat da sessão</h2><p className="text-xs text-muted-foreground">Mensagens disponíveis apenas durante esta ligação.</p>
          <div role="log" aria-live="polite" className="max-h-64 overflow-y-auto space-y-2">{video.messages.map(m=><p key={m.id} className="text-sm break-words"><strong>{m.name}: </strong>{m.text}</p>)}</div>
          <form className="flex gap-2" onSubmit={async e=>{e.preventDefault();if(await video.send(text))setText('');}}>
            <input aria-label="Mensagem" maxLength={1000} value={text} onChange={e=>setText(e.target.value)} className="min-w-0 flex-1 bg-muted rounded-lg px-3 py-2" /><Button type="submit" disabled={!text.trim()}>Enviar</Button>
          </form>
        </section>
      </>}
      {isHost && session.invitees.length>0 && <section className="space-y-2"><h2>Convidados</h2>{session.invitees.map(i=><div key={i.user_id} className="flex items-center justify-between gap-2 border rounded p-2"><span>{i.display_name || 'Participante'} · {({accepted:'Aceitou',declined:'Recusou',maybe:'Talvez',pending:'Pendente'} as Record<string,string>)[i.rsvp_status]}</span>{i.waiting&&<Button onClick={async()=>{try{await scheduledAction('admit',session.id,{user_id:i.user_id});await refetch();}catch{setEndError('Não foi possível admitir. Tenta novamente.');}}}>Admitir</Button>}</div>)}</section>}
      {!isHost && session.status==='scheduled' && <div className="flex flex-wrap gap-2">{['accepted','maybe','declined'].map((status,i)=><Button key={status} onClick={async()=>{try{await scheduledAction('rsvp',session.id,{status});setEndError('');await refetch();}catch(e){setEndError(e instanceof Error?e.message:'Não foi possível responder.');}}}>{['Aceitar','Talvez','Recusar'][i]}</Button>)}</div>}
      {isHost&&session.status==='scheduled'&&<Button onClick={()=>setEditing(true)}>Editar agendamento</Button>}
      <ScheduleCallSheet open={editing} onOpenChange={setEditing} existingCall={session}/>
    </section>
    {(!closed || !!endError) && <footer className="shrink-0 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex flex-wrap justify-center gap-2">
      {video.room && <><Button disabled={session.call_type==='voice'} variant="outline" aria-pressed={video.room.localParticipant.isCameraEnabled} onClick={()=>void video.toggle('camera')}><Camera className="h-4 w-4 mr-2" />Câmara</Button><Button variant="outline" aria-pressed={video.room.localParticipant.isMicrophoneEnabled} onClick={()=>void video.toggle('microphone')}><Mic className="h-4 w-4 mr-2" />Microfone</Button><Button variant="outline" onClick={video.leave}><PhoneOff className="h-4 w-4 mr-2" />Desligar</Button></>}
      {isHost&&(session.status==='started'||!!endError)&&<Button variant="destructive" disabled={ending} onClick={()=>void end()}>{ending?'A encerrar…':'Encerrar para todos'}</Button>}
    </footer>}
  </main>;
}
