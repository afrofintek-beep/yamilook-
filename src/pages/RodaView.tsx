import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, forwardRef, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Radio,
  Users,
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Mail,
  Star,
  Clock,
  X,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useRoda, useJoinRoda, useSubmitVoz, usePalco, useStartQA, useVozes, useConfirmVozPayment, useMarkVozAnswered } from '@/hooks/usePalco';
import { useRodaStream } from '@/hooks/useRodaStream';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { VideoTrack } from '@/components/live/VideoTrack';
import { AudioTrack } from '@/components/live/AudioTrack';
import { Track } from 'livekit-client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { VozesPanel } from '@/components/palco/VozesPanel';
import { RodaRecordingControls } from '@/components/palco/RodaRecordingControls';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';
const voiceOptions = [
  { type: 'email' as const, icon: Mail, label: 'Email', desc: '24-72h', price: 1 },
  { type: 'live' as const, icon: Mic, get label() { return uiText("Ao Vivo"); }, desc: 'Na Roda', price: 3 },
  { type: 'highlight' as const, icon: Star, get label() { return uiText("Destaque"); }, desc: 'Prioridade', price: 7 },
];

const RodaView = forwardRef<HTMLDivElement>((_, ref) => {
  useUiLocale();
  const { palcoId, rodaId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: rodaData, isLoading } = useRoda(rodaId);
  const { data: palco } = usePalco(palcoId);
  const { data: vozes = [] } = useVozes(rodaId);
  const { selectedCurrency } = useCurrencyRates();
  const joinRoda = useJoinRoda();
  const submitVoz = useSubmitVoz();
  const startQA = useStartQA();
  const confirmPayment = useConfirmVozPayment();
  const markAnswered = useMarkVozAnswered();
  const rodaStream = useRodaStream();

  const [showVozSheet, setShowVozSheet] = useState(false);
  const [showVozesPanel, setShowVozesPanel] = useState(true);
  const [vozesPanelMinimized, setVozesPanelMinimized] = useState(false);
  const [selectedVoiceType, setSelectedVoiceType] = useState<'email' | 'live' | 'highlight'>('email');
  const [customText, setCustomText] = useState('');
  const [hasConnected, setHasConnected] = useState(false);
  const [trackTick, setTrackTick] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const lastTapRef = useRef<number>(0);

  // Format price with user's selected currency
  const formatPrice = (price: number) => {
    if (!selectedCurrency) return `$${price}`;
    // Prices are stored in USD, convert to local currency
    const localValue = price / selectedCurrency.rate_to_usd;
    return `${selectedCurrency.symbol}${Math.round(localValue)}`;
  };

  const roda = rodaData;

  // Check if roda date has passed (2 hours after scheduled time)
  const isDatePassed = (() => {
    if (!roda?.scheduled_at) return false;
    const scheduledDate = new Date(roda.scheduled_at);
    const twoHoursAfter = new Date(scheduledDate.getTime() + 2 * 60 * 60 * 1000);
    return new Date() > twoHoursAfter;
  })();

  const isLive = (roda?.phase === 'content' || roda?.phase === 'qa') && !isDatePassed;
  const isQA = roda?.phase === 'qa' && !isDatePassed;
  const isEnded = roda?.phase === 'ended' || isDatePassed;
  const isGuide = palco?.guide_id === user?.id;
  const isExpiredButNotEnded = isDatePassed && roda?.phase !== 'ended';

  // Join roda participant record on mount
  useEffect(() => {
    if (rodaId && user) {
      joinRoda.mutate(rodaId);
    }
  }, [rodaId, user]);

  // Connect to LiveKit when roda has a room name - only if not ended
  useEffect(() => {
    // Don't connect if roda is ended, already connected, or loading
    if (!roda?.livekit_room_name || hasConnected || rodaStream.loading) return;
    if (roda.phase === 'ended') {
      console.log('[RodaView] Roda is ended, skipping connection');
      return;
    }

    const connect = async () => {
      console.log('[RodaView] Connecting to room:', roda.livekit_room_name, 'as', isGuide ? 'host' : 'viewer');

      const success = isGuide
        ? await rodaStream.connectAsHost(roda.livekit_room_name!)
        : await rodaStream.connectAsViewer(roda.livekit_room_name!);

      if (success) {
        setHasConnected(true);
      }
    };

    connect();
  }, [roda?.livekit_room_name, roda?.phase, hasConnected, isGuide, rodaStream.loading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hasConnected) {
        rodaStream.disconnect();
      }
    };
  }, [hasConnected]);

  // Force re-render when tracks change
  useEffect(() => {
    if (!rodaStream.room) return;

    const bump = () => setTrackTick((n) => n + 1);

    rodaStream.room.on('trackSubscribed', bump);
    rodaStream.room.on('trackUnsubscribed', bump);
    rodaStream.room.on('localTrackPublished', bump);
    rodaStream.room.on('localTrackUnpublished', bump);

    return () => {
      rodaStream.room?.off('trackSubscribed', bump);
      rodaStream.room?.off('trackUnsubscribed', bump);
      rodaStream.room?.off('localTrackPublished', bump);
      rodaStream.room?.off('localTrackUnpublished', bump);
    };
  }, [rodaStream.room]);

  // Find the host's video/audio tracks
  const hostParticipant = isGuide
    ? rodaStream.localParticipant
    : rodaStream.remoteParticipants.find((p) => p.identity.startsWith('host:'));

  // Debug log for viewer
  useEffect(() => {
    if (!isGuide && rodaStream.room) {
      console.log('[RodaView] Viewer state:', {
        remoteParticipants: rodaStream.remoteParticipants.length,
        hostFound: !!hostParticipant,
        hostIdentity: hostParticipant?.identity,
        trackCount: hostParticipant?.trackPublications?.size || 0,
      });
    }
  }, [isGuide, rodaStream.remoteParticipants, hostParticipant, rodaStream.room]);

  const publications = hostParticipant
    ? [...hostParticipant.trackPublications.values()]
    : [];

  // Find camera track - prefer by source, fallback to kind
  const cameraPub = publications.find((p) =>
    p.source === Track.Source.Camera && p.track && p.isSubscribed
  ) ?? publications.find((p) =>
    p.kind === Track.Kind.Video && p.track && p.isSubscribed
  ) ?? publications.find((p) =>
    p.kind === Track.Kind.Video && p.track
  );

  // Find microphone track - prefer by source, fallback to kind
  const micPub = publications.find((p) =>
    p.source === Track.Source.Microphone && p.track && p.isSubscribed
  ) ?? publications.find((p) =>
    p.kind === Track.Kind.Audio && p.track && p.isSubscribed
  ) ?? publications.find((p) =>
    p.kind === Track.Kind.Audio && p.track
  );

  const videoTrack = cameraPub?.track ?? null;
  const audioTrack = micPub?.track ?? null;

  // Log track discovery
  useEffect(() => {
    console.log('[RodaView] Track state:', {
      videoTrack: videoTrack?.kind,
      audioTrack: audioTrack?.kind,
      publications: publications.map(p => ({ kind: p.kind, source: p.source, subscribed: p.isSubscribed, hasTrack: !!p.track })),
    });
  }, [videoTrack, audioTrack, publications.length]);

  if (isLoading) {
    return (
      <div ref={ref} className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-white">{uiText("Carregando...")}</div>
      </div>
    );
  }

  const handleSubmitVoz = () => {
    if (!rodaId) return;

    submitVoz.mutate({
      roda_id: rodaId,
      voice_type: selectedVoiceType,
      custom_text: customText || undefined,
    }, {
      onSuccess: () => {
        setShowVozSheet(false);
        setCustomText('');
      }
    });
  };

  const handleConfirmPayment = (vozId: string) => {
    if (!rodaId) return;
    setConfirmingId(vozId);
    confirmPayment.mutate({ vozId, rodaId }, {
      onSettled: () => setConfirmingId(null),
    });
  };

  const handleMarkAnswered = (vozId: string) => {
    if (!rodaId) return;
    setAnsweringId(vozId);
    markAnswered.mutate({ vozId, rodaId }, {
      onSettled: () => setAnsweringId(null),
    });
  };

  // Count active vozes for badge
  const activeVozesCount = vozes.filter(v => v.status === 'paid' || v.status === 'queued').length;
  const pendingVozesCount = vozes.filter(v => v.status === 'pending').length;

  return (
    <div ref={ref} className="min-h-screen bg-black text-white flex flex-col">
      {/* Video/Content Area */}
      <div className="relative flex-1 bg-gradient-to-br from-palco-accent/20 to-black flex items-center justify-center">
        {/* Video Layer */}
        {videoTrack ? (
          <>
            <VideoTrack
              track={videoTrack}
              className="absolute inset-0 w-full h-full object-cover"
              muted={isGuide}
            />
            {audioTrack && <AudioTrack track={audioTrack} muted={isGuide} />}
          </>
        ) : isLive && rodaStream.loading ? (
          <div className="text-center">
            <Radio className="w-16 h-16 mx-auto mb-4 text-palco-accent animate-pulse" />
            <p className="text-lg font-medium">{uiText("Conectando...")}</p>
          </div>
        ) : isLive ? (
          <div className="text-center">
            <Radio className="w-16 h-16 mx-auto mb-4 text-red-500 animate-pulse" />
            <p className="text-lg font-medium">
              {isQA ? uiText("Sessão de Q&A") : uiText("Aguardando vídeo...")}
            </p>
            {rodaStream.error && (
              <p className="text-sm text-red-400 mt-2">{rodaStream.error}</p>
            )}
          </div>
        ) : isEnded ? (
          <div className="text-center px-6">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-palco-accent/70" />
            <p className="text-xl font-semibold mb-2">{uiText("Roda Terminada")}</p>
            <p className="text-sm text-white/60">
              {isExpiredButNotEnded
                ? uiText("Esta sessão já passou da data agendada.")
                : uiText("Esta sessão já foi realizada e terminou.")}
            </p>
            {roda?.ended_at && !isExpiredButNotEnded && (
              <p className="text-xs text-white/40 mt-2">{uiText("Encerrada há ")}{formatDistanceToNow(new Date(roda.ended_at), {
                  locale: pt,
                  addSuffix: false
                })}
              </p>
            )}
            {isExpiredButNotEnded && roda?.scheduled_at && (
              <p className="text-xs text-white/40 mt-2">{uiText("Agendada para ")}{new Date(roda.scheduled_at).toLocaleDateString(uiLocale(), {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
            <Button
              className="mt-6 bg-palco-accent hover:bg-palco-accent/90 text-palco-surface rounded-full"
              onClick={() => navigate(`/palco/${palcoId}`)}
            >{uiText("Voltar ao Palco")}</Button>
          </div>
        ) : (
          <div className="text-center">
            <Clock className="w-16 h-16 mx-auto mb-4 text-palco-accent/50" />
            <p className="text-lg font-medium">{uiText("Aguardando início")}</p>
            {roda?.scheduled_at && (
              <p className="text-sm text-white/60 mt-2">{uiText("Começa daqui a ")}{formatDistanceToNow(new Date(roda.scheduled_at), {
                  locale: pt,
                  addSuffix: false
                })}
              </p>
            )}
          </div>
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2">
            {isEnded ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-palco-text-secondary/50 rounded-full text-xs font-medium">
                <CheckCircle className="w-3 h-3" />{uiText("TERMINADA")}</div>
            ) : isLive ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500 rounded-full text-xs font-medium">
                <Radio className="w-3 h-3 animate-pulse" />
                {isQA ? uiText("Q&A") : uiText("LIVE")}
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs">
              <Users className="w-3 h-3" />
              {roda?.viewer_count || 0}
            </div>
          </div>
        </div>

        {/* Guide Info */}
        {palco?.guide && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full pr-3 z-10">
            <Avatar className="w-8 h-8 border border-palco-accent">
              <AvatarImage src={palco.guide.avatar_url || ''} />
              <AvatarFallback className="bg-palco-accent text-white text-xs">
                {palco.guide.display_name?.[0] || 'G'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-medium">{palco.guide.display_name}</p>
              <p className="text-[10px] text-white/60">{t('palco.guide')}</p>
            </div>
          </div>
        )}

        {/* Recording Controls for Host */}
        {isGuide && isLive && palcoId && rodaId && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
            <RodaRecordingControls
              rodaId={rodaId}
              palcoId={palcoId}
              isHost={true}
              room={rodaStream.room}
            />
          </div>
        )}

        {/* Host Controls */}
        {isGuide && isLive && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "rounded-full",
                rodaStream.isCameraEnabled ? "bg-white/20" : "bg-destructive"
              )}
              onClick={rodaStream.toggleCamera}
            >
              {rodaStream.isCameraEnabled ? (
                <Video className="w-5 h-5" />
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "rounded-full",
                rodaStream.isMicrophoneEnabled ? "bg-white/20" : "bg-destructive"
              )}
              onClick={rodaStream.toggleMicrophone}
            >
              {rodaStream.isMicrophoneEnabled ? (
                <Mic className="w-5 h-5" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="bg-white/20 rounded-full"
              onClick={rodaStream.flipCamera}
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Guide Vozes Panel (Side) - Tap to minimize, Double-tap to close */}
      {isGuide && isQA && showVozesPanel && (
        <motion.div
          className={cn(
            "absolute top-20 right-4 z-20 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 cursor-pointer select-none",
            vozesPanelMinimized ? "w-auto p-2" : "w-64 max-h-[60vh] overflow-y-auto p-3"
          )}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          onTouchStart={(e) => {
            const now = Date.now();
            const DOUBLE_TAP_DELAY = 300;

            if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
              // Double tap - close panel
              e.preventDefault();
              setShowVozesPanel(false);
            } else {
              // Single tap - toggle minimize
              lastTapRef.current = now;
              setTimeout(() => {
                if (Date.now() - lastTapRef.current >= DOUBLE_TAP_DELAY) {
                  setVozesPanelMinimized(prev => !prev);
                }
              }, DOUBLE_TAP_DELAY);
            }
          }}
        >
          {vozesPanelMinimized ? (
            <div className="flex items-center gap-2 text-white">
              <MessageSquare className="w-4 h-4 text-palco-accent" />
              <span className="text-xs font-medium">
                {vozes.filter(v => v.status === 'paid' || v.status === 'queued').length}
              </span>
            </div>
          ) : (
            <VozesPanel
              vozes={vozes}
              isGuide={true}
              onConfirmPayment={handleConfirmPayment}
              onMarkAnswered={handleMarkAnswered}
              confirmingId={confirmingId}
              answeringId={answeringId}
              isCompact={true}
            />
          )}
        </motion.div>
      )}

      {/* Floating button to reopen Vozes panel if closed */}
      {isGuide && isQA && !showVozesPanel && (
        <motion.button
          className="absolute top-20 right-4 z-20 bg-palco-accent text-white p-3 rounded-full shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setShowVozesPanel(true);
            setVozesPanelMinimized(false);
          }}
        >
          <MessageSquare className="w-5 h-5" />
          {vozes.filter(v => v.status === 'paid' || v.status === 'queued').length > 0 && (
            <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {vozes.filter(v => v.status === 'paid' || v.status === 'queued').length}
            </span>
          )}
        </motion.button>
      )}

      {/* Bottom Action Bar - Hide when roda is ended */}
      {!isEnded && (
        <div className="p-4 bg-gradient-to-t from-black via-black to-transparent">
          <div className="flex items-center gap-3">
            {/* Guide can start Q&A when in content phase */}
            {isGuide && roda?.phase === 'content' && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-full h-12"
                onClick={() => rodaId && startQA.mutate(rodaId)}
                disabled={startQA.isPending}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                {startQA.isPending ? uiText("Iniciando...") : uiText("Iniciar Q&A")}
              </Button>
            )}

            {/* Guide sees vozes count during Q&A */}
            {isGuide && isQA && (
              <div className="flex items-center gap-2 text-sm text-white">
                {pendingVozesCount > 0 && (
                  <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full text-xs">
                    {pendingVozesCount}{uiText(" pendentes")}</span>
                )}
                {activeVozesCount > 0 && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                    {activeVozesCount}{uiText(" prontas")}</span>
                )}
              </div>
            )}

            {/* Viewers see the Q&A button */}
            {!isGuide && (
              <Button
                className="flex-1 bg-palco-accent hover:bg-palco-accent/90 text-white rounded-full h-12"
                onClick={() => setShowVozSheet(true)}
                disabled={!isQA}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                {isQA ? uiText("Enviar Voz") : uiText("Q&A não iniciado")}
              </Button>
            )}
          </div>

          {!isQA && !isGuide && roda?.qa_start_at && (
            <p className="text-center text-xs text-white/50 mt-2">{uiText("Q&A começa ")}{formatDistanceToNow(new Date(roda.qa_start_at), {
                locale: pt,
                addSuffix: true
              })}
            </p>
          )}
        </div>
      )}

      {/* Voice Submission Sheet */}
      <Sheet open={showVozSheet} onOpenChange={setShowVozSheet}>
        <SheetContent side="bottom" className="bg-palco-surface rounded-t-[24px] border-palco-border" hideCloseButton>
          <div className="w-12 h-1 bg-palco-border rounded-full mx-auto mb-4" />

          <SheetHeader className="mb-6">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-palco-text">{uiText("Enviar Voz")}</SheetTitle>
              <Button
                size="icon"
                variant="ghost"
                className="text-palco-text-secondary"
                onClick={() => setShowVozSheet(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </SheetHeader>

          {/* Voice Type Selection */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {voiceOptions.map((option) => {
              const Icon = option.icon;
              const voiceType = palco?.voice_types?.find(vt => vt.voice_type === option.type);
              const price = voiceType?.price || option.price;
              const isSelected = selectedVoiceType === option.type;

              return (
                <button
                  key={option.type}
                  onClick={() => setSelectedVoiceType(option.type)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-[12px] border transition-all",
                    isSelected
                      ? "bg-palco-accent/10 border-palco-accent"
                      : "bg-palco-bg border-palco-border"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    isSelected ? "bg-palco-accent text-white" : "bg-palco-border text-palco-text-secondary"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-palco-accent" : "text-palco-text"
                    )}>
                      {option.label}
                    </p>
                    <p className="text-[10px] text-palco-text-secondary">{option.desc}</p>
                    <p className={cn(
                      "text-sm font-semibold mt-1",
                      isSelected ? "text-palco-accent" : "text-palco-text"
                    )}>
                      {formatPrice(price)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Text */}
          {palco?.allow_custom_voice_text && (
            <div className="mb-6">
              <label className="text-sm font-medium text-palco-text mb-2 block">{uiText("Sua pergunta (opcional)")}</label>
              <Textarea
                placeholder={uiText("Escreva sua pergunta aqui...")}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="bg-palco-bg border-palco-border resize-none"
                rows={3}
              />
            </div>
          )}

          {/* Submit Button */}
          <Button
            className="w-full bg-palco-accent hover:bg-palco-accent/90 text-white rounded-full h-12"
            onClick={handleSubmitVoz}
            disabled={submitVoz.isPending}
          >
            {submitVoz.isPending ? uiText("Enviando...") : uiText("Pagar e Enviar Voz")}
            <Send className="w-4 h-4 ml-2" />
          </Button>

          <p className="text-center text-xs text-palco-text-secondary mt-3">{uiText("Pagamento via Multicaixa ou outros métodos")}</p>
        </SheetContent>
      </Sheet>
    </div>
  );
});

RodaView.displayName = 'RodaView';

export default RodaView;
