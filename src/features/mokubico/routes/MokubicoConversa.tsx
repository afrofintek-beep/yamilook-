import { scrollChatToEnd } from '@/lib/chat-scroll';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, Lock, Mic, MicOff, Send, PhoneOff, Users, Check, CheckCheck, Video, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VideoTrack } from '@/components/live/VideoTrack';
import { useMokubicoRoom } from '../hooks/useMokubicoRoom';
import { toast } from 'sonner';

interface ConversaInfo {
  title: string | null;
  space: string;
  host_id: string;
  livekit_room_name: string;
  status: string;
  media_enabled: boolean;
}

export default function MokubicoConversa() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');
  const [conversa, setConversa] = useState<ConversaInfo | null>(null);
  const [text, setText] = useState('');
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const isHost = !!conversa && conversa.host_id === user?.id;
  const room = useMokubicoRoom(id ?? null, conversa?.livekit_room_name ?? null);
  const self = room.peers.find((p) => p.id === room.selfId);
  const others = room.peers.filter((p) => p.id !== room.selfId);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('mokubico_conversas')
      .select('title, space, host_id, livekit_room_name, status, media_enabled')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setConversa(data); setState('ok'); }
        else setState('denied');
      });
  }, [id]);

  // Join the LiveKit room only when this conversa has voice/video enabled
  // (a free Quintal is text-only → no media session at all).
  useEffect(() => {
    if (state === 'ok' && conversa?.status === 'live' && conversa?.media_enabled) room.connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, conversa?.status, conversa?.media_enabled]);

  useEffect(() => { scrollChatToEnd(messagesViewportRef.current, 'smooth'); }, [room.messages.length]);

  const send = () => { room.sendMessage(text); setText(''); };

  const endConversa = async () => {
    if (!id) return;
    await supabase.from('mokubico_conversas').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', id);
    room.leave();
    toast.success('Conversa terminada.');
    navigate(`/mokubico/${conversa?.space ?? ''}`);
  };

  const leave = () => { room.leave(); navigate(`/mokubico/${conversa?.space ?? ''}`); };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Esta conversa é privada. Não estás na lista de convidados.</p>
        <Button variant="ghost" onClick={() => navigate('/mokubico')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const ended = conversa?.status !== 'live';
  const media = conversa?.media_enabled ?? true; // free Quintal = text-only

  return (
    <div className="flex flex-col h-screen-safe overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] border-b border-border safe-top shrink-0">
        <button onClick={leave} className="p-1 -ml-1"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate">{conversa?.title || 'Conversa'}</h1>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />{' '}
            {ended
              ? 'terminada'
              : !media
                ? 'só texto'
                : `${room.peers.length || 1} · ${room.connected ? 'ao vivo' : room.connecting ? 'a entrar…' : 'offline'}`}
          </p>
        </div>
        {isHost && !ended && (
          <Button size="sm" variant="destructive" className="rounded-full h-8" onClick={endConversa}>Terminar</Button>
        )}
      </header>

      {/* Participants (voice/video) — only when media is enabled. */}
      {media && (
      <div ref={stageRef} className="relative px-4 py-4 shrink-0 border-b border-border/50 min-h-[8.5rem]">
        {room.error ? (
          <p className="text-xs text-destructive text-center">{room.error}</p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 pr-24">
              {others.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    'relative w-28 h-28 rounded-2xl overflow-hidden bg-muted flex items-center justify-center shrink-0 transition-shadow',
                    p.speaking && 'ring-2 ring-green-500',
                  )}
                >
                  {p.videoTrack ? (
                    <VideoTrack track={p.videoTrack} className="w-full h-full object-cover" />
                  ) : (
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={room.avatars[p.id] ?? undefined} />
                      <AvatarFallback>{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <span className="absolute bottom-1 left-2 right-2 truncate text-[11px] text-white drop-shadow">{p.name}</span>
                </div>
              ))}
              {others.length === 0 && (
                <p className="text-xs text-muted-foreground self-center">
                  {room.connecting ? 'A entrar…' : 'À espera de mais pessoas…'}
                </p>
              )}
            </div>

            {self && (
              <motion.div
                drag
                dragConstraints={stageRef}
                dragMomentum={false}
                className={cn(
                  'absolute bottom-3 right-4 z-10 w-20 h-28 rounded-xl overflow-hidden bg-muted border-2 border-background shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing',
                  self.speaking && 'ring-2 ring-green-500',
                )}
              >
                {self.videoTrack ? (
                  <VideoTrack track={self.videoTrack} muted className="w-full h-full object-cover -scale-x-100" />
                ) : (
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={room.avatars[self.id] ?? undefined} />
                    <AvatarFallback>{self.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
                <span className="absolute bottom-0.5 left-1.5 text-[10px] text-white drop-shadow">Tu</span>
              </motion.div>
            )}
          </>
        )}
      </div>
      )}

      {/* Text chat */}
      <div ref={messagesViewportRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-2">
        {room.messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sê o primeiro a escrever.</p>
        ) : (
          room.messages.map((m) => {
            const mine = m.senderId === room.selfId;
            // Read when another member's cursor is at/after this message.
            const readByOther = mine && Object.entries(room.reads).some(
              ([uid, ts]) => uid !== room.selfId && ts >= m.createdAt,
            );
            return (
              <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                <div className={cn('max-w-[80%] rounded-2xl px-3 py-1.5 text-sm', mine ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
                  {!mine && <div className="text-[10px] font-semibold opacity-70">{m.senderName}</div>}
                  {m.text}
                </div>
                {mine && (
                  <span className="mt-0.5 mr-1" title={readByOther ? 'Lida' : 'Enviada'}>
                    {readByOther
                      ? <CheckCheck className="w-3.5 h-3.5 text-primary" />
                      : <Check className="w-3.5 h-3.5 text-muted-foreground" />}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Controls */}
      {ended ? (
        <div className="p-4 border-t border-border text-center text-sm text-muted-foreground shrink-0">
          Esta conversa terminou.
        </div>
      ) : (
        <div className="p-3 border-t border-border flex items-center gap-2 shrink-0 safe-bottom">
          {media ? (
            <>
              <Button
                size="icon"
                variant={room.micOn ? 'secondary' : 'destructive'}
                className="rounded-full h-11 w-11 shrink-0"
                onClick={room.toggleMic}
                disabled={!room.connected}
              >
                {room.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              <Button
                size="icon"
                variant={room.camOn ? 'default' : 'secondary'}
                className="rounded-full h-11 w-11 shrink-0"
                onClick={room.toggleCamera}
                disabled={!room.connected}
                title={room.camOn ? 'Desligar câmara' : 'Ligar câmara'}
              >
                {room.camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => toast.info('Voz e vídeo no Quintal é uma funcionalidade Pro.')}
              className="rounded-full h-11 px-3 shrink-0 flex items-center gap-1.5 bg-secondary text-muted-foreground text-xs font-medium"
              title="Voz e vídeo é Pro"
            >
              <Lock className="h-4 w-4" /> Pro
            </button>
          )}
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Escreve uma mensagem…"
            className="h-11 rounded-full"
          />
          <Button size="icon" className="rounded-full h-11 w-11 shrink-0" onClick={send} disabled={!text.trim()}>
            <Send className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="destructive" className="rounded-full h-11 w-11 shrink-0" onClick={leave}>
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
