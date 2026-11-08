import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Track, Participant, ConnectionState } from 'livekit-client';
import { ArrowLeft, Camera, Mic, PhoneOff, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { VideoTrack } from '@/components/live/VideoTrack';
import { AudioTrack } from '@/components/live/AudioTrack';
import { EmptyStateBack } from '@/components/common/EmptyStateBack';
import { downloadAcademiaDiagnostics } from '../hooks/academia-call-diagnostics';
import { SessionClock } from '../components/SessionClock';
import { requestAcademiaVideo, useAcademiaVideo } from '../hooks/useAcademiaVideo';

function ParticipantTile({participant,local}:{participant:Participant;local:boolean}) {
  useUiLocale();
  const camera=participant.getTrackPublication(Track.Source.Camera);
  const microphone=participant.getTrackPublication(Track.Source.Microphone);
  return <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-border">
    {camera?.track && !camera.isMuted ? <VideoTrack track={camera.track} muted className="w-full h-full object-contain" /> : <div className="h-full grid place-items-center text-muted-foreground">{uiText("Câmara desligada")}</div>}
    {!local && microphone?.track && !microphone.isMuted && <AudioTrack track={microphone.track} />}
    <div className="absolute bottom-1 left-2 right-2 flex justify-between gap-2 text-xs text-white bg-black/60 rounded px-2 py-1">
      <span className="truncate">{participant.name || uiText("Participante")}{local?uiText(" (tu)"):''}</span><span>{microphone?.isMuted===false?uiText("Microfone ligado"):uiText("Sem microfone")}</span>
    </div>
  </div>;
}
export default function AcademiaLiveRoom() {
  useUiLocale();
  const {sessionId}=useParams<{sessionId:string}>();
  const navigate=useNavigate();const {user}=useAuth();
  const video=useAcademiaVideo(sessionId);
  const [camera,setCamera]=useState(false);const [microphone,setMicrophone]=useState(false);
  const [text,setText]=useState('');const [ending,setEnding]=useState(false);const [endError,setEndError]=useState('');
  const {data:session,isLoading,error,refetch,dataUpdatedAt}=useQuery({
    queryKey:['academia-live-session',sessionId],enabled:!!sessionId,refetchInterval:5000,
    queryFn:async()=>{const {data,error}=await supabase.from('academia_sessions').select('*').eq('id',sessionId!).maybeSingle();if(error)throw error;return data;},
  });
  const isMentor=!!user && session?.mentor_id===user.id;
  const opensAt=new Date(new Date(session?.scheduled_at || '').getTime()-15*60*1000);
  const tooEarly=isMentor && session?.status==='scheduled' && opensAt.getTime()>Math.max(Date.now(),dataUpdatedAt);
  const closed=!!session && ['ended','completed','cancelled'].includes(session.status);
  useEffect(()=>{if(closed)video.leave();},[closed,video.leave]);
  const exit=()=>{video.leave();navigate('/academia',{replace:true});};
  const end=async()=>{
    if(!sessionId||ending)return;setEnding(true);setEndError('');
    try{await requestAcademiaVideo(sessionId,'end');video.leave();await refetch();}
    catch(e){setEndError(e instanceof Error?e.message:'Não foi possível encerrar.');}
    finally{setEnding(false);}
  };
  if(isLoading)return <div className="h-screen-safe bg-background grid place-items-center">{uiText("A carregar sessão…")}</div>;
  if(error&&!session)return <EmptyStateBack message="Não foi possível carregar a sessão." fallbackRoute="/academia" />;
  if(!session)return <EmptyStateBack message="Sessão não encontrada." fallbackRoute="/academia" />;
  return <main className="fixed inset-0 h-screen-safe overflow-hidden flex flex-col bg-background">
    <header className="shrink-0 safe-top border-b border-border bg-background"><div className="h-14 px-3 flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label={uiText("Sair da sala")} onClick={exit}><ArrowLeft /></Button>
      <h1 className="min-w-0 flex-1 truncate font-semibold">{session.title}</h1>
      <span className="text-xs shrink-0">{closed?uiText("Encerrada"):video.connection===ConnectionState.Connected?uiText("Ligado"):video.connection===ConnectionState.Reconnecting?uiText("A religar…"):uiText("Academia")}</span>
    </div>
      <SessionClock session={session} isMentor={isMentor} onUpdated={async()=>{await refetch();}} />
    </header>
    <section className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
      {error && <p role="status" className="text-sm text-muted-foreground">{uiText("Não foi possível atualizar os dados da sessão. A tentar novamente…")}</p>}
      {(video.error||endError) && <p role="alert" className="rounded-xl border border-destructive p-3 text-sm">{endError||video.error}<Button variant="outline" className="mt-2 block" onClick={downloadAcademiaDiagnostics}>{uiText("Descarregar diagnóstico")}</Button>{video.error.includes('Inicia sessão novamente') && <Button className="mt-3 block" onClick={async()=>{video.leave();await supabase.auth.signOut({scope:'local'});navigate('/login');}}>{uiText("Entrar novamente")}</Button>}</p>}
      {closed ? <div className="space-y-3"><p>{uiText("A sessão foi encerrada.")}</p><Button onClick={exit}>{uiText("Voltar à Academia")}</Button></div> : !video.room ? <div className="max-w-lg mx-auto space-y-5">
        <h2 className="text-lg font-semibold">{isMentor?uiText("Iniciar sessão de vídeo"):uiText("Entrar na sessão de vídeo")}</h2>
        <p className="text-sm text-muted-foreground">{isMentor?(tooEarly?uiText("Esta sala abre em {{value1}}. Podes entrar 15 minutos antes da hora marcada.", { value1: (opensAt.toLocaleString(uiLocale(),{dateStyle:'short',timeStyle:'short'})) ?? "" }):uiText("Podes abrir a sala 15 minutos antes da hora marcada.")):uiText("A entrada está disponível após o mentor iniciar a sessão, para quem tem uma reserva válida.")}</p>
        <label className="flex items-center gap-3"><input type="checkbox" checked={camera} onChange={e=>setCamera(e.target.checked)} />{uiText("Entrar com câmara")}</label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={microphone} onChange={e=>setMicrophone(e.target.checked)} />{uiText("Entrar com microfone")}</label>
        <Button className="w-full" disabled={video.loading||tooEarly||(!isMentor&&session.status!=='live')} onClick={()=>void video.join(isMentor,camera,microphone)}>{video.loading?uiText("A ligar…"):isMentor?uiText("Iniciar / entrar"):uiText("Entrar na sala")}</Button>
      </div> : <>
        {video.connection===ConnectionState.Reconnecting && <p role="status">{uiText("A religar à sala… Mantém esta página aberta.")}</p>}
        {video.audioBlocked && <Button className="w-full" onClick={()=>void video.room?.startAudio()}><Volume2 className="mr-2 h-4 w-4" />{uiText("Ativar som")}</Button>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{video.participants.map(p=><ParticipantTile key={p.identity} participant={p} local={p===video.room?.localParticipant} />)}</div>
        <p className="text-sm text-muted-foreground">{uiText("{{value1}} participante(s) ligado(s)", { value1: (video.participants.length) ?? "" })}</p>
        <section aria-label={uiText("Chat da sessão")} className="border border-border rounded-xl p-3 space-y-3">
          <h2 className="font-semibold">{uiText("Chat da sessão")}</h2><p className="text-xs text-muted-foreground">{uiText("Mensagens disponíveis apenas durante esta ligação.")}</p>
          <div role="log" aria-live="polite" className="max-h-64 overflow-y-auto space-y-2">{video.messages.map(m=><p key={m.id} className="text-sm break-words"><strong>{m.name}: </strong>{m.text}</p>)}</div>
          <form className="flex gap-2" onSubmit={async e=>{e.preventDefault();if(await video.send(text))setText('');}}>
            <input aria-label={uiText("Mensagem")} maxLength={1000} value={text} onChange={e=>setText(e.target.value)} className="min-w-0 flex-1 bg-muted rounded-lg px-3 py-2" /><Button type="submit" disabled={!text.trim()}>{uiText("Enviar")}</Button>
          </form>
        </section>
      </>}
    </section>
    {!closed && <footer className="shrink-0 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex flex-wrap justify-center gap-2">
      {video.room && <><Button variant="outline" aria-pressed={video.room.localParticipant.isCameraEnabled} onClick={()=>void video.toggle('camera')}><Camera className="h-4 w-4 mr-2" />{uiText("Câmara")}</Button><Button variant="outline" aria-pressed={video.room.localParticipant.isMicrophoneEnabled} onClick={()=>void video.toggle('microphone')}><Mic className="h-4 w-4 mr-2" />{uiText("Microfone")}</Button><Button variant="outline" onClick={video.leave}><PhoneOff className="h-4 w-4 mr-2" />{uiText("Desligar")}</Button></>}
      {isMentor&&session.status==='live'&&<Button variant="destructive" disabled={ending} onClick={()=>void end()}>{ending?uiText("A encerrar…"):uiText("Encerrar para todos")}</Button>}
    </footer>}
  </main>;
}
