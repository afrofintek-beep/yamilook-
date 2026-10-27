import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Mic, MicOff, Video, VideoOff, Phone, 
  MonitorUp, FlipHorizontal2, Hand, MoreVertical,
  Users, MessageSquare, Settings, Maximize2, Minimize2,
  Volume2, VolumeX, Camera, Shield, LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useActiveCallRequired } from './ActiveCallProvider';
import { useHostControls } from '@/hooks/useHostControls';
import { CallControls } from './CallControls';
import { ParticipantGrid } from './ParticipantGrid';
import { CallReactions } from './CallReactions';
import { VirtualBackgroundPicker } from './VirtualBackgroundPicker';
import { CallEffects } from './CallEffects';
import { RecordingControls } from './RecordingControls';
import { LiveCaptions } from './LiveCaptions';
import { WaitingRoomPanel } from './WaitingRoomPanel';
import { BreakoutRoomsPanel } from './BreakoutRoomsPanel';
import { HostControlsPanel } from './HostControlsPanel';
import { cn } from '@/lib/utils';
import { CallChatPanel } from './CallChatPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';

interface VideoCallProps {
  conversationId?: string | null;
  callId: string;
  callType: 'voice' | 'video';
  participants: Array<{
    id: string;
    user_id: string;
    display_name: string;
    avatar_url: string | null;
    is_muted: boolean;
    is_video_enabled: boolean;
    is_screen_sharing: boolean;
    is_hand_raised: boolean;
    is_spotlight: boolean;
    role?: string;
  }>;
  onEndCall: () => void;
  isGroupCall?: boolean;
  isHost?: boolean;
}

export function VideoCall({ 
  conversationId,
  callId, 
  callType, 
  participants, 
  onEndCall,
  isGroupCall = false,
  isHost = false,
}: VideoCallProps) {
  const callViewportRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const fit = () => {
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      const root = callViewportRef.current;
      if (root) { root.style.height = `${viewport?.height ?? window.innerHeight}px`; root.style.top = `${viewport?.offsetTop ?? 0}px`; }
    };
    fit(); viewport?.addEventListener('resize', fit); viewport?.addEventListener('scroll', fit); window.addEventListener('resize', fit);
    return () => { viewport?.removeEventListener('resize', fit); viewport?.removeEventListener('scroll', fit); window.removeEventListener('resize', fit); };
  }, []);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const callChatInputRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isPipMode, setIsPipMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showChat, setShowChat] = useState(true);
  // Keep the composer mounted after first opening so drafts survive switching back to the call.
  const [chatOpenedOnce, setChatOpenedOnce] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showBackgrounds, setShowBackgrounds] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showHostControls, setShowHostControls] = useState(false);
  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [showBreakoutRooms, setShowBreakoutRooms] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [activeReactions, setActiveReactions] = useState<Array<{ id: string; emoji: string }>>([]);
  const [userIsHost, setUserIsHost] = useState(isHost);

  const { checkIsHost } = useHostControls(callId);
  
  // Use the shared WebRTC state from ActiveCallProvider context
  const {
    webRTCState: state,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    flipCamera,
    setVirtualBackground,
    raiseHand,
    sendReaction,
    endCall,
  } = useActiveCallRequired();

  // Check if user is host
  useEffect(() => {
    const checkHostStatus = async () => {
      const hostStatus = await checkIsHost();
      setUserIsHost(hostStatus);
    };
    checkHostStatus();
  }, [checkIsHost]);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && state.localStream) {
      localVideoRef.current.srcObject = state.localStream;
    }
  }, [state.localStream]);

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (!document.documentElement.requestFullscreen) throw new Error('unsupported');
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      setIsFullscreen(!!document.fullscreenElement);
    } catch {
      toast({ title: 'Ecrã inteiro indisponível', description: 'O navegador não permitiu abrir o ecrã inteiro.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    const update = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const toggleHand = async () => {
    try {
      await raiseHand(!handRaised);
      setHandRaised(value => !value);
    } catch {
      toast({ title: 'Não foi possível atualizar a mão levantada', variant: 'destructive' });
    }
  };

  // Toggle PiP mode
  const togglePip = async () => {
    if (localVideoRef.current) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipMode(false);
      } else {
        await localVideoRef.current.requestPictureInPicture();
        setIsPipMode(true);
      }
    }
  };

  // Handle reaction
  const handleReaction = (emoji: string) => {
    const id = crypto.randomUUID();
    setActiveReactions(prev => [...prev, { id, emoji }]);
    sendReaction(emoji);
    setTimeout(() => {
      setActiveReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  // Auto-hide controls
  useEffect(() => {
    // Keep essential controls available on touch devices without hover/mousemove.
    if (window.matchMedia('(pointer: coarse)').matches) return;
    let timeout: ReturnType<typeof setTimeout>;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 4000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  const handleEndCall = () => {
    endCall();
    onEndCall();
  };

  const openCallChat = () => {
    // Mount and focus in the same tap: iOS otherwise declines to open its keyboard.
    flushSync(() => {
      setChatOpenedOnce(true);
      setShowChat(true);
    });
    callChatInputRef.current?.focus({ preventScroll: true });
  };

  // Debug: Log state for troubleshooting
  console.log('[VideoCall] callStatus:', state.callStatus, 'localStream:', !!state.localStream, 'isMuted:', state.isMuted, 'isVideoEnabled:', state.isVideoEnabled);
  
  return (
    <div ref={callViewportRef}
      data-testid="call-layout"
      className={cn(
        "fixed inset-x-0 top-0 z-50 flex flex-col w-full bg-black overflow-hidden",
        isFullscreen && "fixed inset-0 z-50"
      )}
      style={{ height: "var(--kosolola-height, 100dvh)" }}
    >
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
      <Button variant="secondary" className="min-h-11" onClick={openCallChat}>
        <MessageSquare className="h-4 w-4 mr-2" />Escrever mensagem
      </Button>
      <span role="status" className="rounded-full bg-black/70 px-3 py-1 text-sm text-white">
        {(state.callStatus === 'connected' && state.connectionState === 'connected') ? 'Ligada' : state.callStatus === 'ringing' ? 'A chamar…' : state.lastError || 'A estabelecer ligação…'}
      </span>
      </header>
      {/* Main Video Grid */}
      <section data-testid="call-stage" className="relative min-h-0 flex-1 basis-0 overflow-hidden">
      <ParticipantGrid
        participants={participants}
        localStream={state.localStream}
        remoteStreams={state.remoteStreams}
        screenStream={state.screenStream}
        isScreenSharing={state.isScreenSharing}
        callType={callType}
      />

      {/* Local Video (Picture-in-Picture style) */}
      {callType === 'video' && !state.isScreenSharing && (participants.length > 0 || state.remoteStreams.size > 0) && (
        <motion.div
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          className="absolute right-3 top-3 w-20 h-24 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-20"
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={cn(
              "w-full h-full object-cover",
              !state.isVideoEnabled && "hidden"
            )}
          />
          {!state.isVideoEnabled && (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Avatar className="h-16 w-16">
                <AvatarFallback>You</AvatarFallback>
              </Avatar>
            </div>
          )}
          {state.isMuted && (
            <div className="absolute bottom-2 right-2 p-1 rounded-full bg-destructive">
              <MicOff className="h-3 w-3 text-destructive-foreground" />
            </div>
          )}
        </motion.div>
      )}

      </section>
      {chatOpenedOnce && (
        <CallChatPanel
          inline
          conversationId={conversationId}
          contactId={!isGroupCall && participants.length === 1 ? participants[0].user_id : undefined}
          open={showChat}
          inputRef={callChatInputRef}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Active Reactions */}
      <AnimatePresence>
        {activeReactions.map(reaction => (
          <motion.div
            key={reaction.id}
            initial={{ y: 100, opacity: 0, scale: 0 }}
            animate={{ y: -200, opacity: 1, scale: 1.5 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 text-6xl z-30"
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Raised Hands Indicator */}
      {participants.some(p => p.is_hand_raised) && (
        <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-2 rounded-lg flex items-center gap-2 z-20">
          <Hand className="h-4 w-4" />
          <span className="text-sm font-medium">
            {t('calls.raisedHands', { count: participants.filter(p => p.is_hand_raised).length })}
          </span>
        </div>
      )}

      <Sheet open={showParticipants} onOpenChange={setShowParticipants}>
        <SheetContent className="safe-top overflow-y-auto">
          <SheetHeader className="pr-12 py-4">
            <SheetTitle>Participantes ({participants.length + 1})</SheetTitle>
            <SheetDescription>Pessoas nesta chamada</SheetDescription>
          </SheetHeader>
          <ul className="space-y-3">
            <li>Tu — {state.isMuted ? 'microfone desligado' : 'microfone ligado'}</li>
            {participants.map(participant => <li key={participant.user_id} className="rounded-xl border p-3">
              <p className="font-medium">{participant.display_name}</p>
              <p className="text-sm text-muted-foreground">{participant.is_muted ? 'Microfone desligado' : 'Microfone ligado'}{participant.is_hand_raised ? ' · Mão levantada' : ''}</p>
            </li>)}
          </ul>
        </SheetContent>
      </Sheet>

      {/* Call Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="call-controls" className="shrink-0 z-30"
          >
            <div className="bg-black p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
              {/* Main Controls */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {/* Mute */}
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-11 w-11 shrink-0 rounded-full border-white/20 bg-white/10 hover:bg-white/20",
                    state.isMuted && "bg-red-500 hover:bg-red-600 border-red-500"
                  )}
                  onClick={toggleMute}
                  aria-label={state.isMuted ? 'Ligar microfone' : 'Desligar microfone'}
                  aria-pressed={state.isMuted}
                >
                  {state.isMuted ? (
                    <MicOff className="h-6 w-6 text-white" />
                  ) : (
                    <Mic className="h-6 w-6 text-white" />
                  )}
                </Button>

                {/* Video Toggle */}
                {callType === 'video' && (
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-11 w-11 shrink-0 rounded-full border-white/20 bg-white/10 hover:bg-white/20",
                      !state.isVideoEnabled && "bg-red-500 hover:bg-red-600 border-red-500"
                    )}
                    onClick={toggleVideo}
                    aria-label={state.isVideoEnabled ? 'Desligar câmara' : 'Ligar câmara'}
                  >
                    {state.isVideoEnabled ? (
                      <Video className="h-6 w-6 text-white" />
                    ) : (
                      <VideoOff className="h-6 w-6 text-white" />
                    )}
                  </Button>
                )}

                {/* End Call */}
                <Button
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full bg-red-500 hover:bg-red-600"
                  onClick={handleEndCall}
                  aria-label="Desligar chamada"
                >
                  <Phone className="h-6 w-6 text-white rotate-135" />
                </Button>

                {/* Flip Camera */}
                {callType === 'video' && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-full border-white/20 bg-white/10 hover:bg-white/20"
                    onClick={flipCamera}
                    aria-label="Trocar câmara"
                  >
                    <FlipHorizontal2 className="h-6 w-6 text-white" />
                  </Button>
                )}

                <CallReactions inline onReaction={handleReaction} />

                {/* More Options */}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full border-white/20 bg-white/10 hover:bg-white/20"
                  onClick={() => setShowEffects(true)}
                  aria-label="Definições da chamada"
                >
                  <MoreVertical className="h-6 w-6 text-white" />
                </Button>
              </div>

              {/* Secondary Controls */}
                <div className="flex items-center gap-2 mt-2 overflow-x-auto [&>button]:shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => setShowParticipants(!showParticipants)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  {t('calls.participants')} ({participants.length + 1})
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => showChat ? setShowChat(false) : openCallChat()}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t('calls.chat')}
                </Button>

                {/* Screen Share */}
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-11 w-11 shrink-0 rounded-full border-white/20 bg-white/10 hover:bg-white/20",
                    state.isScreenSharing && "bg-primary hover:bg-primary/90 border-primary"
                  )}
                  onClick={toggleScreenShare}
                  disabled={!state.isScreenSharing && !navigator.mediaDevices?.getDisplayMedia}
                  aria-label={state.isScreenSharing ? 'Parar partilha de ecrã' : 'Partilhar ecrã'}
                  title={!navigator.mediaDevices?.getDisplayMedia ? 'Partilha de ecrã não suportada neste navegador' : undefined}
                >
                  <MonitorUp className="h-6 w-6 text-white" />
                </Button>

                {/* Raise Hand */}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full border-white/20 bg-white/10 hover:bg-white/20"
                  onClick={toggleHand}
                  aria-label={handRaised ? 'Baixar a mão' : 'Levantar a mão'}
                  aria-pressed={handRaised}
                >
                  <Hand className="h-6 w-6 text-white" />
                </Button>

                {/* Host Controls Button - Only visible to hosts in group calls */}
                {isGroupCall && userIsHost && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-white/70 hover:text-white hover:bg-white/10",
                      showHostControls && "text-primary bg-primary/20"
                    )}
                    onClick={() => setShowHostControls(!showHostControls)}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    {t('calls.hostControls')}
                  </Button>
                )}

                {/* Breakout Rooms - Only visible to hosts in group calls */}
                {isGroupCall && userIsHost && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-white/70 hover:text-white hover:bg-white/10",
                      showBreakoutRooms && "text-primary bg-primary/20"
                    )}
                    onClick={() => setShowBreakoutRooms(!showBreakoutRooms)}
                  >
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    {t('calls.breakout')}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => setShowBackgrounds(!showBackgrounds)}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {t('calls.backgrounds')}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => setShowEffects(!showEffects)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {t('calls.effects')}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-white/70 hover:text-white hover:bg-white/10",
                    "opacity-50"
                  )}
                  disabled
                  aria-label="Legendas indisponíveis"
                  title="A transcrição de chamadas ainda não está implementada"
                >
                  CC
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={toggleFullscreen}
                  disabled={!document.fullscreenEnabled}
                  aria-label={isFullscreen ? 'Sair do ecrã inteiro' : 'Abrir ecrã inteiro'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reactions Bar */}


      {/* Virtual Background Picker */}
      {showBackgrounds && (
        <VirtualBackgroundPicker
          onSelect={(id, mode) => { setSelectedBackground(id); setVirtualBackground(mode); }}
          selectedBackground={selectedBackground}
          onClose={() => setShowBackgrounds(false)}
        />
      )}

      {/* Call Effects Panel */}
      {showEffects && (
        <CallEffects onClose={() => setShowEffects(false)} />
      )}

      {/* Recording Controls */}
      <RecordingControls callId={callId} participants={participants} />

      {/* Host Controls Panel */}
      <HostControlsPanel
        callId={callId}
        participants={participants.map(p => ({ ...p, role: p.role || 'participant' }))}
        isOpen={showHostControls}
        onClose={() => setShowHostControls(false)}
        onOpenWaitingRoom={() => {
          setShowHostControls(false);
          setShowWaitingRoom(true);
        }}
        onOpenBreakoutRooms={() => {
          setShowHostControls(false);
          setShowBreakoutRooms(true);
        }}
      />

      {/* Waiting Room Panel */}
      <WaitingRoomPanel
        callId={callId}
        isOpen={showWaitingRoom}
        onClose={() => setShowWaitingRoom(false)}
      />

      {/* Breakout Rooms Panel */}
      <BreakoutRoomsPanel
        callId={callId}
        participants={participants}
        isOpen={showBreakoutRooms}
        onClose={() => setShowBreakoutRooms(false)}
      />
    </div>
  );
}
