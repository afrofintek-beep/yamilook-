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
import { requestAcademiaVideo, useAcademiaVideo } from '../hooks/useAcademiaVideo';

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
export default function AcademiaLiveRoom() {
  const {sessionId}=useParams<{sessionId:string}>();
  const navigate=useNavigate();const {user}=useAuth();
  const video=useAcademiaVideo(sessionId);
  const [camera,setCamera]=useState(false);const [microphone,setMicrophone]=useState(false);
  const [text,setText]=useState('');const [ending,setEnding]=useState(false);const [endError,setEndError]=useState('');
  const {data:session,isLoading,error,refetch}=useQuery({
    queryKey:['academia-live-session',sessionId],enabled:!!sessionId,refetchInterval:5000,
    queryFn:async()=>{const {data,error}=await supabase.from('academia_sessions').select('*').eq('id',sessionId!).maybeSingle();if(error)throw error;return data;},
  });
  const isMentor=!!user && session?.mentor_id===user.id;
  const closed=!!session && ['ended','completed','cancelled'].includes(session.status);
  useEffect(()=>{if(closed)video.leave();},[closed,video.leave]);
  const exit=()=>{video.leave();navigate(`/academia/${sessionId}`);};
  const end=async()=>{
    if(!sessionId||ending)return;setEnding(true);setEndError('');
    try{await requestAcademiaVideo(sessionId,'end');video.leave();await refetch();}
    catch(e){setEndError(e instanceof Error?e.message:'Não foi possível encerrar.');}
    finally{setEnding(false);}
  };
  if(isLoading)return <div className="h-screen-safe bg-background grid place-items-center">A carregar sessão…</div>;
  if(error)return <EmptyStateBack message="Não foi possível carregar a sessão." fallbackRoute="/academia" />;
  if(!session)return <EmptyStateBack message="Sessão não encontrada." fallbackRoute="/academia" />;
  return <main className="fixed inset-0 h-screen-safe overflow-hidden flex flex-col bg-background">
    <header className="shrink-0 safe-top border-b border-border bg-background"><div className="h-14 px-3 flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label="Sair da sala" onClick={exit}><ArrowLeft /></Button>
      <h1 className="min-w-0 flex-1 truncate font-semibold">{session.title}</h1>
      <span className="text-xs shrink-0">{closed?'Encerrada':video.connection===ConnectionState.Connected?'Ligado':video.connection===ConnectionState.Reconnecting?'A religar…':'Academia'}</span>
    </div></header>
    <section className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
      {(video.error||endError) && <p role="alert" className="rounded-xl border border-destructive p-3 text-sm">{endError||video.error}</p>}
      {closed ? <div className="space-y-3"><p>A sessão foi encerrada.</p><Button onClick={exit}>Ver sessão</Button></div> : !video.room ? <div className="max-w-lg mx-auto space-y-5">
        <h2 className="text-lg font-semibold">{isMentor?'Iniciar sessão de vídeo':'Entrar na sessão de vídeo'}</h2>
        <p className="text-sm text-muted-foreground">{isMentor?'Podes abrir a sala 15 minutos antes da hora marcada.':'A entrada está disponível após o mentor iniciar a sessão, para quem tem uma reserva válida.'}</p>
        <label className="flex items-center gap-3"><input type="checkbox" checked={camera} onChange={e=>setCamera(e.target.checked)} />Entrar com câmara</label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={microphone} onChange={e=>setMicrophone(e.target.checked)} />Entrar com microfone</label>
        <Button className="w-full" disabled={video.loading||(!isMentor&&session.status!=='live')} onClick={()=>void video.join(isMentor,camera,microphone)}>{video.loading?'A ligar…':isMentor?'Iniciar / entrar':'Entrar na sala'}</Button>
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
    </section>
    {!closed && <footer className="shrink-0 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex flex-wrap justify-center gap-2">
      {video.room && <><Button variant="outline" aria-pressed={video.room.localParticipant.isCameraEnabled} onClick={()=>void video.toggle('camera')}><Camera className="h-4 w-4 mr-2" />Câmara</Button><Button variant="outline" aria-pressed={video.room.localParticipant.isMicrophoneEnabled} onClick={()=>void video.toggle('microphone')}><Mic className="h-4 w-4 mr-2" />Microfone</Button><Button variant="outline" onClick={video.leave}><PhoneOff className="h-4 w-4 mr-2" />Desligar</Button></>}
      {isMentor&&session.status==='live'&&<Button variant="destructive" disabled={ending} onClick={()=>void end()}>{ending?'A encerrar…':'Encerrar para todos'}</Button>}
    </footer>}
  </main>;
}
