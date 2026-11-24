import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { scrollChatToEnd } from '@/lib/chat-scroll';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, Lock, Mic, MicOff, Send, PhoneOff, Users, Check, CheckCheck, Video, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VideoTrack } from '@/components/live/VideoTrack';
import { MokubicoParticipants } from '../components/MokubicoParticipants';
import { useMokubicoRoom } from '../hooks/useMokubicoRoom';
import { useEndConversa } from '../hooks/useMokubicoConversas';
import { useActiveCall } from '@/components/calls/ActiveCallProvider';
import { AudioInterruption } from '@/components/calls/AudioInterruption';
import { toast } from 'sonner';

interface ConversaInfo {
  title: string | null;
  space: string;
  host_id: string;
  livekit_room_name: string;
  status: string;
  media_enabled: boolean;
}

export default function MokubicoConversa({ id, minimized, onPin }: { id: string; minimized: boolean; onPin: (id?: string) => void }) {
  useUiLocale();

  const navigate = useNavigate();
  const { user } = useAuth();
  const endMutation = useEndConversa();
  const endingRef = useRef(false);
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');
  const [conversa, setConversa] = useState<ConversaInfo | null>(null);
  const [text, setText] = useState('');
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  const isHost = !!conversa && conversa.host_id === user?.id;
  const room = useMokubicoRoom(id ?? null, conversa?.livekit_room_name ?? null, !minimized && !expanded);
  const directBusy = useActiveCall()?.mediaBusy;
  const [paused, setPaused] = useState(false);
  const [resumeMic, setResumeMic] = useState(true);
  useEffect(() => {
    const pause = () => {
      if (!room.connected && !room.connecting) return;
      setResumeMic(room.micOn);
      setPaused(true);
      room.leave();
    };
    window.addEventListener('yamilook:direct-media', pause);
    return () => window.removeEventListener('yamilook:direct-media', pause);
  }, [room.connected, room.connecting, room.micOn, room.leave]);
  const remotePreview = room.connected ? room.peers.find((peer) => peer.id !== room.selfId) : undefined;
  const showExpanded = expanded && room.connected && conversa?.status === 'live';

  useEffect(() => {
    if (!room.connected || conversa?.status !== 'live') setExpanded(false);
  }, [room.connected, conversa?.status]);

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
    if (state === 'ok' && conversa?.status === 'live' && conversa?.media_enabled && !directBusy && !paused) room.connect(resumeMic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, conversa?.status, conversa?.media_enabled, directBusy, paused]);

  useEffect(() => {
    if (!minimized && !showExpanded) scrollChatToEnd(messagesViewportRef.current, 'smooth');
  }, [minimized, room.messages.length, showExpanded]);

  useEffect(() => {
    onPin(paused || room.connected || room.connecting ? id : undefined);
  }, [id, paused, room.connected, room.connecting, onPin]);

  const send = () => { room.sendMessage(text); setText(''); };

  const endConversa = async () => {
    if (!id || !isHost || endingRef.current) return;
    endingRef.current = true;
    try {
      await endMutation.mutateAsync(id);
      onPin(undefined); room.leave();
      toast.success(uiText("Conversa terminada."));
      navigate(`/mokubico/${conversa?.space ?? ''}`);
    } catch {
      toast.error(uiText("Não foi possível terminar a conversa. Tenta novamente."));
    } finally {
      endingRef.current = false;
    }
  };

  const leave = () => { onPin(undefined); room.leave(); navigate(`/mokubico/${conversa?.space ?? ''}`); };

  if (minimized && directBusy) return null;
  if (minimized) return <aside className="fixed right-3 top-[max(1rem,env(safe-area-inset-top))] z-[80] max-w-48 rounded-xl border bg-background p-2 shadow-lg">
    {remotePreview?.videoTrack && <VideoTrack track={remotePreview.videoTrack} className="h-24 w-full rounded-lg object-cover" />}
    <button className="block p-2"
    onClick={() => navigate(`/mokubico/conversa/${id}`)}>{conversa?.title} · {uiText("Voltar à chamada")}</button>
    {room.connected && <Button variant="ghost" onClick={room.toggleMic}>{room.micOn ? uiText("Desligar microfone") : uiText("Ligar microfone")}</Button>}
    <AudioInterruption stream={room.micStream} muted={!room.micOn || paused} recover={room.recoverAudio} />
  </aside>;

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
        <p className="text-sm text-muted-foreground">{uiText("Esta conversa é privada. Não estás na lista de convidados.")}</p>
        <Button variant="ghost" onClick={() => navigate('/mokubico')}>
          <ArrowLeft className="w-4 h-4 mr-2" />{uiText(" Voltar")}</Button>
      </div>
    );
  }

  const ended = conversa?.status !== 'live';
  const media = conversa?.media_enabled ?? true; // free Quintal = text-only
  const mediaStatus = room.connected
    ? `${room.peers.length || 1} · ${uiText("Áudio ao vivo")}`
    : room.connecting ? uiText("A entrar…") : uiText("Sem ligação");

  return (
    <div className="flex flex-col h-screen-safe overflow-hidden bg-background">
      <AudioInterruption stream={room.micStream} muted={!room.micOn || paused} recover={room.recoverAudio} />
      {paused && !directBusy && <Button onClick={() => setPaused(false)}>{uiText("Retomar chamada")}</Button>}
      {directBusy && <p role="status">{uiText("Chamada em curso no KOSOLOLA")}</p>}
      {/* Header */}
      <header className="flex items-center gap-3 px-4 min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] border-b border-border safe-top shrink-0">
        <button aria-label={uiText("Voltar")} onClick={() => navigate(`/mokubico/${conversa?.space ?? ''}`)} className="p-1 -ml-1"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate">{conversa?.title || uiText("Conversa")}</h1>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />{' '}
            {ended
              ? uiText("terminada")
              : !media
                ? uiText("só texto")
                : mediaStatus}
          </p>
        </div>
        {isHost && !ended && (
          <Button size="sm" variant="destructive" className="rounded-full h-8" onClick={endConversa} disabled={endMutation.isPending}>
            {endMutation.isPending ? uiText("A terminar…") : uiText("Terminar")}
          </Button>
        )}
      </header>

      {media && !ended && (
        room.error ? (
          <p role="status" className="shrink-0 border-b border-border/50 p-4 text-center text-xs text-destructive">{room.error}</p>
        ) : (
          <MokubicoParticipants
            peers={room.connected ? room.peers : []}
            selfId={room.selfId}
            avatars={room.avatars}
            connecting={room.connecting}
            expanded={showExpanded}
            onExpandedChange={setExpanded}
          />
        )
      )}

      {/* Text chat */}
      <div ref={messagesViewportRef} hidden={showExpanded}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-2">
        {room.messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">{uiText("Sê o primeiro a escrever.")}</p>
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
                  <span className="mt-0.5 mr-1" title={readByOther ? uiText("Lida") : uiText("Enviada")}>
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
        <div className="p-4 border-t border-border text-center text-sm text-muted-foreground shrink-0">{uiText("Esta conversa terminou.")}</div>
      ) : (
        <div className={cn("p-3 border-t border-border flex items-center gap-2 shrink-0 safe-bottom", showExpanded && "justify-center")}>
          {media ? (
            <>
              <Button
                size="icon"
                variant={room.micOn ? 'secondary' : 'destructive'}
                className="rounded-full h-11 w-11 shrink-0"
                onClick={room.toggleMic}
                disabled={!room.connected}
                aria-label={room.micOn ? uiText("Desligar microfone") : uiText("Ligar microfone")}
                title={room.micOn ? uiText("Desligar microfone") : uiText("Ligar microfone")}
              >
                {room.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              <Button
                size="icon"
                variant={room.camOn ? 'default' : 'secondary'}
                className="rounded-full h-11 w-11 shrink-0"
                onClick={room.toggleCamera}
                disabled={!room.connected}
                aria-label={room.camOn ? uiText("Desligar câmara") : uiText("Ligar câmara")}
                title={room.camOn ? uiText("Desligar câmara") : uiText("Ligar câmara")}
              >
                {room.camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => toast.info(uiText("Voz e vídeo no Quintal é uma funcionalidade Pro."))}
              className="rounded-full h-11 px-3 shrink-0 flex items-center gap-1.5 bg-secondary text-muted-foreground text-xs font-medium"
              title={uiText("Voz e vídeo é Pro")}
            >
              <Lock className="h-4 w-4" />{uiText(" Pro")}</button>
          )}
          {!showExpanded && (
            <>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                placeholder={uiText("Escreve uma mensagem…")}
                className="h-11 min-w-0 rounded-full"
              />
              <Button size="icon" className="rounded-full h-11 w-11 shrink-0" onClick={send} disabled={!text.trim()} aria-label={uiText("Enviar mensagem")}>
                <Send className="h-5 w-5" />
              </Button>
            </>
          )}
          <Button size="icon" variant="destructive" className="rounded-full h-11 w-11 shrink-0" onClick={leave} aria-label={uiText("Sair da sala")} title={uiText("Sair da sala")}>
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
