import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { VideoTrack } from '@/components/live/VideoTrack';
import { uiText } from '@/i18n/ui-copy';
import { cn } from '@/lib/utils';
import type { MokubicoPeer } from '../hooks/useMokubicoRoom';

interface ParticipantsProps {
  peers: MokubicoPeer[];
  selfId: string;
  avatars: Record<string, string | null>;
  connecting: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function MokubicoParticipants({ peers, selfId, avatars, connecting, expanded, onExpandedChange }: ParticipantsProps) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const viewButtonRef = useRef<HTMLButtonElement>(null);
  const [pinnedId, setPinnedId] = useState<string>();
  const [lastSpeakerId, setLastSpeakerId] = useState<string>();
  const self = peers.find((peer) => peer.id === selfId);
  const others = peers.filter((peer) => peer.id !== selfId);
  const pinned = peers.find((peer) => peer.id === pinnedId);
  const currentSpeakerId = (
    peers.find((peer) => peer.speaking && peer.id === lastSpeakerId) ??
    peers.find((peer) => peer.speaking)
  )?.id;
  const featured = pinned ?? peers.find((peer) => peer.id === (currentSpeakerId ?? lastSpeakerId)) ??
    others.find((peer) => peer.videoTrack) ?? (self?.videoTrack ? self : others[0] ?? self);

  useEffect(() => {
    if (currentSpeakerId) setLastSpeakerId(currentSpeakerId);
    if (pinnedId && !pinned) setPinnedId(undefined);
  }, [currentSpeakerId, pinnedId, pinned]);

  const showPeer = (id: string) => {
    setPinnedId(id);
    viewButtonRef.current?.focus();
    onExpandedChange(true);
  };

  const peerName = (peer: MokubicoPeer) => peer.id === selfId ? uiText("Tu") : peer.name;
  const pinLabel = (peer: MokubicoPeer) => peer.id === selfId
    ? uiText("Destacar o meu vídeo")
    : uiText("Destacar {{name}}", { name: peer.name });
  const renderPeer = (peer: MokubicoPeer, large = false) => (
    <MokubicoParticipant
      peer={peer}
      local={peer.id === selfId}
      avatar={avatars[peer.id]}
      name={peerName(peer)}
      large={large}
    />
  );

  return (
    <section className={cn('border-b border-border/50 px-3 py-2 sm:px-4', expanded ? 'flex min-h-0 flex-1 flex-col gap-2' : 'shrink-0')}>
      {peers.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-2">
          {expanded && pinned && (
            <Button type="button" size="sm" variant="ghost" onClick={() => {
              setPinnedId(undefined);
              viewButtonRef.current?.focus();
            }}>
              {uiText("Seguir quem fala")}
            </Button>
          )}
          <Button ref={viewButtonRef} type="button" size="sm" variant="ghost" className="gap-2" onClick={() => {
            setPinnedId(undefined);
            onExpandedChange(!expanded);
          }}>
            {expanded ? <Minimize2 aria-hidden="true" className="h-4 w-4" /> : <Maximize2 aria-hidden="true" className="h-4 w-4" />}
            {expanded ? uiText("Voltar à conversa") : uiText("Maximizar vídeo")}
          </Button>
        </div>
      )}
      {expanded && featured ? (
        <div className="flex min-h-0 flex-1 gap-2">
          <div role="group" aria-label={peerName(featured)} className="relative min-w-0 flex-1 overflow-hidden rounded-xl bg-muted">
            {renderPeer(featured, true)}
          </div>
          {peers.length > 1 && (
            <div className="flex w-20 shrink-0 flex-col gap-2 overflow-y-auto overscroll-contain p-0.5 sm:w-32">
              {peers.filter((peer) => peer.id !== featured.id).map((peer) => (
                <button key={peer.id} type="button" aria-label={pinLabel(peer)} title={pinLabel(peer)}
                  onClick={() => showPeer(peer.id)} className="relative aspect-square shrink-0 overflow-hidden rounded-xl bg-muted sm:aspect-video">
                  {renderPeer(peer)}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div ref={galleryRef} className="relative min-h-28">
          <div className={cn('flex min-h-28 items-center gap-2 overflow-x-auto p-0.5', self && 'pr-24')}>
            {others.map((peer) => (
              <button key={peer.id} type="button" aria-label={pinLabel(peer)} title={pinLabel(peer)}
                onClick={() => showPeer(peer.id)} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                {renderPeer(peer)}
              </button>
            ))}
            {others.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {connecting ? uiText("A entrar…") : uiText("À espera de mais pessoas…")}
              </p>
            )}
          </div>
          {self && (
            <motion.div drag dragConstraints={galleryRef} dragMomentum={false}
              className="absolute bottom-1 right-1 z-10 h-24 w-20 cursor-grab overflow-hidden rounded-xl bg-muted shadow-lg active:cursor-grabbing">
              {renderPeer(self)}
              <button type="button" title={pinLabel(self)} aria-label={pinLabel(self)}
                onPointerDown={(event) => event.stopPropagation()} onClick={() => showPeer(self.id)}
                className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white">
                <Maximize2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </div>
      )}
    </section>
  );
}

function MokubicoParticipant({ peer, local, avatar, name, large }: {
  peer: MokubicoPeer;
  local: boolean;
  avatar?: string | null;
  name: string;
  large: boolean;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {peer.videoTrack ? (
        <VideoTrack track={peer.videoTrack} muted className={cn('h-full w-full', large ? 'object-contain' : 'object-cover', local && '-scale-x-100')} />
      ) : (
        <Avatar className={large ? 'h-20 w-20 sm:h-28 sm:w-28' : 'h-9 w-9'}>
          <AvatarImage src={avatar ?? undefined} />
          <AvatarFallback>{peer.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      <span className={cn('absolute bottom-1 left-1 flex max-w-[calc(100%-0.5rem)] items-center gap-1 rounded bg-black/70 px-1.5 text-white',
        large ? 'text-sm' : 'text-xs')}>
        {peer.speaking && <span role="img" aria-label={uiText("A falar")} className="h-2 w-2 shrink-0 rounded-full bg-green-400" />}
        <span className="truncate">{name}</span>
      </span>
      {peer.speaking && <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl border-2 border-green-500" />}
    </div>
  );
}
