import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Radio,
  Clock,
  MessageSquare,
  Calendar,
  Share2,
  Heart,
  CheckCircle2,
  ChevronRight,
  Users,
  Sparkles,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePalco, usePalcoReaction, usePalcosForRoda, Roda, VoiceType } from '@/hooks/usePalco';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from '@/i18n/ui-date';
import { pt } from 'date-fns/locale';
import { GuideProfileSheet } from '@/components/palco/GuideProfileSheet';
import { PalcoIcon } from '@/components/icons/PalcoIcon';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';
import { AfricanReactionType, getReaction, AFRICAN_REACTIONS } from '@/lib/reactions';
import { AnimatePresence } from 'framer-motion';


export default function PalcoDetail() {
  useUiLocale();
  const { palcoId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: palco, isLoading } = usePalco(palcoId);
  const { data: siblingPalcos } = usePalcosForRoda(palco?.roda_id || undefined);
  const { myReaction, react } = usePalcoReaction(palcoId);
  const [showReactions, setShowReactions] = useState(false);
  const [showGuideSheet, setShowGuideSheet] = useState(false);
  const [countdown, setCountdown] = useState<string>('');

  const isOwner = user?.id === palco?.guide_id;
  const isLive = palco?.status === 'live';

  // Countdown timer for roda
  useEffect(() => {
    if (!palco?.roda?.scheduled_at) return;

    const updateCountdown = () => {
      const scheduledTime = new Date(palco.roda!.scheduled_at!);
      const now = new Date();
      const diff = scheduledTime.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('Ao vivo');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setCountdown(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [palco?.roda?.scheduled_at]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-palco-bg flex items-center justify-center">
        <div className="animate-pulse text-palco-accent">{uiText("Carregando...")}</div>
      </div>
    );
  }

  if (!palco) {
    return (
      <div className="min-h-screen bg-palco-bg flex flex-col items-center justify-center p-4">
        <Sparkles className="w-12 h-12 text-palco-accent/50 mb-4" />
        <h2 className="text-lg font-medium text-palco-text mb-2">{uiText("Palco não encontrado")}</h2>
        <Button variant="outline" onClick={() => navigate('/palco')}>{uiText("Voltar")}</Button>
      </div>
    );
  }

  const currentRodaNumber = siblingPalcos?.length || 1;

  return (
    <div className="min-h-screen bg-palco-bg pb-8">
      {/* Header with Logo */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <Button
            size="icon"
            variant="ghost"
            className="text-palco-text hover:bg-palco-accent/10"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col items-center">
            <YamilookLogo size="sm" showTagline={false} animate={false} className="opacity-90" bgClassName="bg-palco-bg" />
            <div className="flex items-center gap-1.5 mt-1">
              <PalcoIcon className="w-5 h-5 text-palco-accent" filled />
              <span className="text-xl font-bold text-palco-text tracking-tight">PALCO</span>
            </div>
          </div>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Card */}
      <div className="px-4 mt-4">
        <div className="bg-palco-surface rounded-[24px] overflow-hidden shadow-md">
          {/* Cover Image with Badge */}
          <div className="relative aspect-[16/9]">
            {palco.cover_url ? (
              <img
                src={palco.cover_url}
                alt={palco.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('Cover image failed to load:', palco.cover_url);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-palco-accent/20 to-palco-accent/5 flex items-center justify-center">
                <Sparkles className="w-16 h-16 text-palco-accent/30" />
              </div>
            )}

            {/* Live Badge */}
            {isLive && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-palco-accent text-palco-surface rounded-full text-sm font-semibold shadow-md">{uiText("EM DIRETO")}</div>
            )}

            {/* Action Buttons */}
            <div className="absolute top-3 left-3 flex gap-2">
              {isOwner && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 w-8 h-8"
                  onClick={() => navigate(`/palco/${palcoId}/edit`)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="absolute top-3 right-3 flex gap-2">
              {!isLive && (
                <>
                  <div className="relative">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 w-8 h-8"
                      onClick={() => {
                        if (myReaction) {
                          react(myReaction); // toggle off
                        } else {
                          setShowReactions(prev => !prev);
                        }
                      }}
                      onMouseEnter={() => setShowReactions(true)}
                      onMouseLeave={() => setShowReactions(false)}
                    >
                      {myReaction ? (
                        <motion.span
                          key={myReaction}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-lg"
                        >
                          {getReaction(myReaction)?.icon || '💛'}
                        </motion.span>
                      ) : (
                        <span className="text-lg grayscale opacity-60">💛</span>
                      )}
                    </Button>
                    <AnimatePresence>
                      {showReactions && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: 4 }}
                          className="absolute top-full right-0 mt-1 flex gap-1 bg-black/60 backdrop-blur-md rounded-full px-2 py-1.5 shadow-lg z-20"
                          onMouseEnter={() => setShowReactions(true)}
                          onMouseLeave={() => setShowReactions(false)}
                        >
                          {AFRICAN_REACTIONS.map((r) => (
                            <button
                              key={r.type}
                              onClick={() => {
                                react(r.type);
                                setShowReactions(false);
                              }}
                              className={cn(
                                "text-xl hover:scale-125 transition-transform p-0.5 rounded-full",
                                myReaction === r.type && "bg-white/20"
                              )}
                              title={r.label}
                            >
                              {r.icon}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 w-8 h-8 relative z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const shareUrl = `${window.location.origin}/palco/${palcoId}`;
                      if (typeof navigator.share === 'function') {
                        navigator.share({
                          title: palco.title,
                          text: palco.description || palco.title,
                          url: shareUrl,
                        }).catch(() => {
                          // Fallback if share is cancelled or fails
                          navigator.clipboard?.writeText(shareUrl).then(() => {
                            toast({ title: uiText("Link copiado!") });
                          });
                        });
                      } else {
                        // No native share — copy to clipboard
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(shareUrl).then(() => {
                            toast({ title: uiText("Link copiado!") });
                          });
                        } else {
                          // Ultimate fallback
                          const textarea = document.createElement('textarea');
                          textarea.value = shareUrl;
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                          toast({ title: uiText("Link copiado!") });
                        }
                      }
                    }}
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Guide Avatar - Overlapping */}
            <div
              className="absolute -bottom-8 left-4 cursor-pointer"
              onClick={() => setShowGuideSheet(true)}
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full ring-4 ring-palco-accent bg-palco-surface overflow-hidden shadow-lg">
                  <Avatar className="w-full h-full">
                    <AvatarImage src={palco.guide?.avatar_url || ''} />
                    <AvatarFallback className="bg-palco-accent text-palco-surface text-2xl">
                      {palco.guide?.display_name?.[0] || 'G'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {/* Small Palco Icon */}
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-palco-accent rounded-full flex items-center justify-center shadow-md">
                  <PalcoIcon className="w-3.5 h-3.5 text-palco-surface" filled />
                </div>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="pt-12 px-4 pb-5">
            {/* Guide Info */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-semibold text-palco-text">
                {palco.guide?.display_name}
              </span>
              {palco.guide?.is_verified && (
                <CheckCircle2 className="w-4 h-4 text-palco-accent fill-palco-accent/20" />
              )}
            </div>
            <p className="text-sm text-palco-text-secondary mb-3">{t('palco.guide')}</p>

            {/* Title */}
            <h1 className="text-2xl font-bold text-palco-text mb-2">{palco.title}</h1>

            {/* Session Info */}
            <div className="flex items-center gap-2 text-sm text-palco-text-secondary mb-4">
            {isLive ? (
                <>
                  <Radio className="w-4 h-4 text-destructive animate-pulse" />
                  <span>{uiText("Em direto agora")}</span>
                </>
              ) : (
                <>
                <Calendar className="w-4 h-4" />
                  {palco.roda?.scheduled_at && (
                    <span>
                       {formatDistanceToNow(new Date(palco.roda.scheduled_at), {
                        locale: pt,
                        addSuffix: true
                      })}
                    </span>
                  )}
                </>
              )}
              <span>•</span>
              <span>{uiText("{{value1}}ª Roda", { value1: (currentRodaNumber) ?? "" })}</span>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2 px-4 py-2 bg-palco-bg rounded-full">
                <MessageSquare className="w-4 h-4 text-palco-accent" />
                <span className="font-semibold text-palco-text">{uiText("{{value1}} VOZES", { value1: (palco.total_voices) ?? "" })}</span>
                <Users className="w-4 h-4 text-palco-text-secondary ml-2" />
                {countdown && (
                  <span className="text-palco-text-secondary">{countdown}</span>
                )}
              </div>
              {countdown && (
                <div className="flex items-center gap-1.5 px-4 py-2 bg-palco-accent text-white rounded-full font-medium">
                  <Clock className="w-4 h-4" />
                  <span>{uiText("{{value1}} Restantes", { value1: (countdown) ?? "" })}</span>
                </div>
              )}
            </div>

            {/* Voice Selection */}
            {palco.voice_types && palco.voice_types.filter(vt => vt.enabled).length > 0 && (
              <VoiceSelector
                voiceTypes={palco.voice_types.filter(vt => vt.enabled)}
                palcoId={palco.id}
                rodaId={palco.roda?.id}
              />
            )}
          </div>
        </div>
      </div>

      {/* Guide Bio Card */}
      <div className="px-4 mt-4">
        <div className="bg-palco-surface/80 rounded-[20px] p-4 shadow-sm">
          <div className="flex gap-4">
            <button
              onClick={() => palco.guide?.id && navigate(`/profile/${palco.guide.id}`)}
              className="flex-shrink-0 group"
            >
              <img
                src={palco.guide?.avatar_url || '/placeholder.svg'}
                alt={palco.guide?.display_name}
                className="w-20 h-24 rounded-xl object-cover ring-2 ring-transparent group-hover:ring-palco-accent transition-all"
              />
            </button>
            <div className="flex-1">
              <button
                onClick={() => palco.guide?.id && navigate(`/profile/${palco.guide.id}`)}
                className="flex items-center gap-1.5 mb-1 group"
              >
                <PalcoIcon className="w-4 h-4 text-palco-accent" filled />
                <span className="font-bold text-palco-text group-hover:text-palco-accent transition-colors">{palco.guide?.display_name}</span>
              </button>
              <p className="text-sm text-palco-text-secondary mb-2">{palco.title}</p>
              <p className="text-sm text-palco-text-secondary leading-relaxed line-clamp-2">
                {palco.description ||
                  (palco.theme ? uiText('Roda com {{name}}, especialista em {{theme}}. Aprende estratégias práticas e fala diretamente com o guia.', { name: palco.guide?.display_name || '', theme: palco.theme }) : uiText('Roda com {{name}}. Aprende estratégias práticas e fala diretamente com o guia.', { name: palco.guide?.display_name || '' }))}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-palco-accent hover:text-palco-accent hover:bg-palco-accent/10 p-0 h-auto font-medium"
                onClick={() => palco.guide?.id && navigate(`/profile/${palco.guide.id}`)}
              >
                {t('palco.viewGuideProfile')} →
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="px-4 mt-5">
        <Button
          className="w-full bg-palco-accent hover:bg-palco-accent/90 text-palco-surface rounded-full h-14 text-lg font-semibold shadow-lg"
          onClick={() => {
            if (palco.roda) {
              navigate(`/palco/${palco.id}/roda/${palco.roda.id}`);
            }
          }}
          disabled={!palco.roda}
        >{uiText("Participar na Roda")}</Button>
      </div>

      {/* Rodas Section */}
      <RodasSection rodas={palco.roda ? [palco.roda] : []} palcoId={palco.id} />

      {/* Guide Profile Sheet */}
      <GuideProfileSheet
        open={showGuideSheet}
        onOpenChange={setShowGuideSheet}
        guide={palco.guide || null}
        isCurrentUserGuide={isOwner}
      />
    </div>
  );
}

// Voice Selection Grid Component
function VoiceSelector({
  voiceTypes,
  palcoId,
  rodaId
}: {
  voiceTypes: VoiceType[];
  palcoId: string;
  rodaId?: string;
}) {
  useUiLocale();
  const navigate = useNavigate();
  const { selectedCurrency } = useCurrencyRates();

  const formatPrice = (price: number) => {
    if (!selectedCurrency) return `$${price}`;
    // Prices are stored in USD, convert to local currency
    const localValue = price / selectedCurrency.rate_to_usd;
    return `${selectedCurrency.symbol}${Math.round(localValue)}`;
  };

  const getVoiceLabel = (type: string) => {
    switch (type) {
      case 'highlight': return 'DESTAQUE';
      case 'live': return 'AO VIVO';
      case 'email': return 'EMAIL';
      default: return type.toUpperCase();
    }
  };

  // Example questions for display
  const sampleQuestions = [
    'Como começar do zero?',
    'Qual o investimento inicial?',
    'Meios práticos de apoio?',
    'Como escalar um negócio?',
  ];

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-palco-text">{uiText("Escolha uma Voz")}</h3>
        <button
          onClick={() => navigate(`/palco/${palcoId}/rodas`)}
          className="text-sm text-palco-text-secondary hover:text-palco-accent flex items-center gap-1"
        >{uiText("Ver Sessões")}<ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Horizontal Scrolling Grid */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {voiceTypes.map((vt, index) => (
          <motion.button
            key={vt.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (rodaId) {
                navigate(`/palco/${palcoId}/voice/${vt.id}?roda=${rodaId}`);
              }
            }}
            className={cn(
              "flex-shrink-0 w-44 p-4 rounded-[16px] text-left transition-all",
              vt.voice_type === 'highlight'
                ? "bg-palco-accent/10"
                : "bg-palco-bg hover:bg-palco-accent/5"
            )}
          >
            {vt.voice_type === 'highlight' && (
              <Badge className="mb-2 bg-palco-accent text-palco-surface text-[10px] px-2 py-0.5 font-semibold">
                {getVoiceLabel(vt.voice_type)}
              </Badge>
            )}
            <p className="text-sm text-palco-text font-medium line-clamp-2 mb-2">
              {sampleQuestions[index % sampleQuestions.length]}
            </p>
            <p className="text-lg font-bold text-palco-accent">
              {formatPrice(vt.price)}
            </p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// Helper to check if roda date has passed
function isRodaPast(roda: Roda): boolean {
  if (!roda.scheduled_at) return false;
  const scheduledDate = new Date(roda.scheduled_at);
  // Consider a roda as past if 2 hours have passed since scheduled time
  const twoHoursAfter = new Date(scheduledDate.getTime() + 2 * 60 * 60 * 1000);
  return new Date() > twoHoursAfter;
}

// Rodas Section Component
function RodasSection({ rodas, palcoId }: { rodas: Roda[] | undefined; palcoId: string }) {
  useUiLocale();
  const navigate = useNavigate();

  if (!rodas || rodas.length === 0) return null;

  // Filter rodas: upcoming are those not ended AND scheduled time hasn't passed
  const upcomingRodas = rodas.filter(r => r.phase !== 'ended' && !isRodaPast(r));
  // Past rodas are either explicitly ended OR their scheduled date has passed
  const pastRodas = rodas.filter(r => r.phase === 'ended' || isRodaPast(r));

  if (upcomingRodas.length === 0 && pastRodas.length === 0) return null;

  return (
    <div className="px-4 mt-6 space-y-4">
      {upcomingRodas.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-palco-text mb-3">{uiText("Próximas Rodas")}</h3>
          <div className="space-y-2">
            {upcomingRodas.map((roda) => (
              <RodaCard key={roda.id} roda={roda} palcoId={palcoId} />
            ))}
          </div>
        </section>
      )}

      {pastRodas.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-palco-text mb-3">{uiText("Rodas Anteriores")}</h3>
          <div className="space-y-2">
            {pastRodas.slice(0, 3).map((roda) => (
              <RodaCard key={roda.id} roda={roda} palcoId={palcoId} past />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Roda Card Component
function RodaCard({ roda, palcoId, past }: { roda: Roda; palcoId: string; past?: boolean }) {
  useUiLocale();
  const navigate = useNavigate();

  // Check if this roda should be considered as ended (date passed)
  const hasDatePassed = isRodaPast(roda);
  const isEffectivelyEnded = roda.phase === 'ended' || hasDatePassed;

  const getPhaseLabel = () => {
    // If date has passed but phase wasn't updated, show as ended
    if (hasDatePassed && roda.phase !== 'ended') {
      return 'Encerrada';
    }
    switch (roda.phase) {
      case 'scheduled': return 'Agendada';
      case 'content': return 'Conteúdo';
      case 'qa': return 'Q&A';
      case 'ended': return 'Encerrada';
      default: return roda.phase;
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/palco/${palcoId}/roda/${roda.id}`)}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-[16px] text-left",
        past || isEffectivelyEnded
          ? "bg-palco-surface/50"
          : "bg-palco-surface shadow-sm"
      )}
    >
      <div className={cn(
        "w-12 h-12 rounded-[12px] flex flex-col items-center justify-center",
        isEffectivelyEnded ? "bg-muted text-muted-foreground" :
        roda.phase === 'qa' ? "bg-destructive text-destructive-foreground" :
        roda.phase === 'content' ? "bg-palco-accent text-palco-surface" :
        "bg-palco-accent/10 text-palco-accent"
      )}>
        {roda.scheduled_at ? (
          <>
            <span className="text-xs font-medium">
              {format(new Date(roda.scheduled_at), 'MMM', { locale: pt }).toUpperCase()}
            </span>
            <span className="text-lg font-bold leading-none">
              {format(new Date(roda.scheduled_at), 'd')}
            </span>
          </>
        ) : (
          <Calendar className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium truncate",
          (past || isEffectivelyEnded) ? "text-palco-text-secondary" : "text-palco-text"
        )}>
          {roda.title || uiText("Roda")}
        </p>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 text-xs text-palco-text-secondary">
            {roda.scheduled_at && (
              <span>{format(new Date(roda.scheduled_at), "HH:mm", { locale: pt })}</span>
            )}
            <Badge variant="secondary" className={cn(
              "text-[10px] px-1.5 py-0",
              isEffectivelyEnded ? "bg-muted text-muted-foreground" : "bg-palco-bg"
            )}>
              {getPhaseLabel()}
            </Badge>
            {roda.viewer_count > 0 && (
              <span className="flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                {roda.viewer_count}
              </span>
            )}
          </div>
          {/* Message explaining why roda is ended */}
          {hasDatePassed && roda.phase !== 'ended' && (
            <span className="text-[10px] text-muted-foreground italic">{uiText("Esta roda já passou da data agendada")}</span>
          )}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-palco-text-secondary" />
    </motion.button>
  );
}
