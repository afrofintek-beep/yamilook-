import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import {
  Radio,
  Clock,
  Plus,
  ChevronRight,
  Sparkles,
  Lock,
  Filter
} from 'lucide-react';
import { usePalcos, Palco, VoiceType } from '@/hooks/usePalco';
import { usePalcoThemes } from '@/hooks/useDiscoverTopics';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { PalcoIcon } from '@/components/icons/PalcoIcon';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';
import { getNearestCountry } from '@/lib/african-locations';
import { getCurrencyForCountry } from '@/lib/country-currency-map';
import { snapToGrid } from '@/lib/geo-privacy';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// Sample questions for display
const sampleQuestions = [
  'Quais os maiores desafios de começar?',
  'Como evitar prejuízos num projeto novo?',
  'Onde devo procurar investidores?',
  'Como validar uma ideia de negócio?',
];

export default function PalcoDiscover() {
  useUiLocale();
  const navigate = useNavigate();
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const { data: palcos, isLoading } = usePalcos(selectedTheme ? { theme: selectedTheme } : undefined);
  const { data: themes } = usePalcoThemes();
  const [countdown, setCountdown] = useState('');
  const { currencies, changeCurrency, selectedCurrency } = useCurrencyRates();
  const gpsAttemptedRef = useRef(false);

  const featuredPalco = palcos?.find(p => p.featured || p.status === 'live');
  const otherPalcos = palcos?.filter(p => p.id !== featuredPalco?.id) || [];

  // Auto-detect currency based on GPS location
  useEffect(() => {
    if (gpsAttemptedRef.current || currencies.length === 0) return;

    // Check if user already has a preferred currency set
    const storedCurrency = localStorage.getItem('preferred_currency');
    if (storedCurrency && storedCurrency !== 'USD') {
      gpsAttemptedRef.current = true;
      return;
    }

    if (!navigator.geolocation) {
      gpsAttemptedRef.current = true;
      return;
    }

    gpsAttemptedRef.current = true;

    // Only use GPS if permission was already granted — never trigger the popup
    const checkAndDetect = async () => {
      try {
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          if (result.state !== 'granted') return;
        } else {
          return; // Can't check, skip to avoid popup
        }
      } catch {
        return;
      }

      const timeout = setTimeout(() => {}, 5000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeout);
          const _cell = snapToGrid(position.coords.latitude, position.coords.longitude);
          const latitude = _cell.lat;
          const longitude = _cell.lng;
          const country = getNearestCountry(latitude, longitude);

          if (country) {
            const currencyCode = getCurrencyForCountry(country.countryCode);
            const found = currencies.find(c => c.currency_code === currencyCode);
            if (found) {
              changeCurrency(currencyCode);
              console.log('[Palco] Auto-detected currency:', found.currency_name);
            }
          }
        },
        () => {
          clearTimeout(timeout);
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    };

    checkAndDetect();
  }, [currencies, changeCurrency]);

  // Countdown timer for featured palco
  useEffect(() => {
    if (!featuredPalco?.roda?.scheduled_at && featuredPalco?.status !== 'live') return;

    const updateCountdown = () => {
      if (featuredPalco.status === 'live') {
        // For live sessions, show remaining time (mock 30min session)
        setCountdown('32:12');
        return;
      }

      const scheduledTime = new Date(featuredPalco.roda!.scheduled_at!);
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
  }, [featuredPalco]);

  return (
    <div className="min-h-screen bg-palco-bg pb-20">
      {/* Header */}
      <header className="px-4 pt-6 pb-4 text-center">
        {/* Yamilook Logo - seamless integration */}
        <div className="flex items-center justify-center mb-3">
          <YamilookLogo size="sm" showTagline={false} animate={false} className="opacity-90" bgClassName="bg-palco-bg" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <PalcoIcon className="w-7 h-7 text-palco-accent" filled />
          <h1 className="text-3xl font-bold text-palco-text tracking-tight">PALCO</h1>
        </div>
        <p className="text-sm text-palco-text-secondary">{uiText("O teu espaço. A tua voz.")}</p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            className="border-palco-accent text-palco-accent hover:bg-palco-accent/10 rounded-full"
            onClick={() => navigate('/palco/dashboard')}
          >{uiText("Meus Palcos")}</Button>
          <Button
            size="icon"
            className="bg-palco-accent text-palco-surface hover:bg-palco-accent/90 rounded-full"
            onClick={() => navigate('/palco/create')}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="px-4 space-y-6">
        {/* Theme Filters */}
        {themes && themes.length > 0 && (
          <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4">
            <div className="flex gap-2 pb-2">
              <button
                onClick={() => setSelectedTheme(null)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all",
                  !selectedTheme
                    ? "bg-palco-accent text-palco-surface"
                    : "bg-palco-surface text-palco-text-secondary border border-palco-border"
                )}
              >{uiText("Todos")}</button>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTheme(selectedTheme === t.slug ? null : t.slug)}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all",
                    selectedTheme === t.slug
                      ? "bg-palco-accent text-palco-surface"
                      : "bg-palco-surface text-palco-text-secondary border border-palco-border hover:border-palco-accent/50"
                  )}
                >
                  {t.image_url && (
                    <img
                      src={t.image_url}
                      alt={t.name}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  )}
                  <span>{t.name}</span>
                  {t.is_trending && (
                    <span className="w-1.5 h-1.5 bg-palco-accent rounded-full" />
                  )}
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        )}

        {/* Featured Palco Card */}
        {featuredPalco && (
          <FeaturedPalcoCard
            palco={featuredPalco}
            countdown={countdown}
          />
        )}

        {/* Other Palcos */}
        {otherPalcos.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-palco-text mb-3">
              {selectedTheme
                ? `Palcos de ${themes?.find(t => t.slug === selectedTheme)?.name || selectedTheme}`
                : uiText("Outros Palcos")}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {otherPalcos.map((palco, index) => (
                <PalcoCard key={palco.id} palco={palco} index={index} />
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!isLoading && (!palcos || palcos.length === 0) && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-palco-accent/10 flex items-center justify-center">
              <PalcoIcon className="w-8 h-8 text-palco-accent" />
            </div>
            <h3 className="text-lg font-medium text-palco-text mb-2">{uiText("Nenhum palco encontrado")}</h3>
            <p className="text-sm text-palco-text-secondary mb-4">{uiText("Seja o primeiro a abrir a Banda ao Vivo!")}</p>
            <Button
              className="bg-palco-accent text-palco-surface rounded-full"
              onClick={() => navigate('/palco/create')}
            >
              <Plus className="w-4 h-4 mr-2" />{uiText("Abrir Banda ao Vivo")}</Button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

// Featured Palco Card with new design
function FeaturedPalcoCard({ palco, countdown }: { palco: Palco; countdown: string }) {
  useUiLocale();
  const navigate = useNavigate();
  const isLive = palco.status === 'live';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-palco-surface rounded-[24px] overflow-hidden shadow-md"
    >
      {/* Cover with overlaid content */}
      <div className="relative">
        <div className="aspect-[4/3] relative">
          {palco.cover_url ? (
            <img
              src={palco.cover_url}
              alt={palco.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-palco-accent/20 to-palco-accent/5 flex items-center justify-center">
              <Sparkles className="w-16 h-16 text-palco-accent/30" />
            </div>
          )}

          {/* Gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

          {/* Live Badge */}
          {isLive && (
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-palco-accent text-palco-surface rounded-full text-sm font-semibold shadow-md">
              <Lock className="w-3.5 h-3.5" />{uiText("AO VIVO • ")}{countdown}{uiText(" restantes")}</div>
          )}

          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-2xl font-bold text-palco-surface mb-2">
              {palco.title}
            </h2>

            <div className="flex items-center gap-2 mb-3">
              <Avatar className="w-8 h-8 border-2 border-palco-surface">
                <AvatarImage src={palco.guide?.avatar_url || ''} />
                <AvatarFallback className="bg-palco-accent text-palco-surface text-xs">
                  {palco.guide?.display_name?.[0] || 'G'}
                </AvatarFallback>
              </Avatar>
              <span className="text-palco-surface/90 text-sm">
                {palco.guide?.display_name}
              </span>
            </div>

            <Button
              className="bg-palco-surface text-palco-text hover:bg-palco-surface/90 rounded-full px-6 font-semibold shadow-md"
              onClick={() => navigate(`/palco/${palco.id}`)}
            >{uiText("Entrar na Roda")}</Button>
          </div>
        </div>
      </div>

      {/* Voices info */}
      <div className="px-4 py-3 border-t border-palco-border">
        <p className="text-sm text-palco-accent font-semibold mb-3">
          + {palco.total_voices || 20}{uiText(" Vozes pagas")}</p>

        {/* Sample questions list */}
        <div className="space-y-2 mb-3">
          <VoiceQuestionsList palco={palco} />
        </div>

        {/* Highlight tip */}
        <div className="flex items-center gap-2 text-xs text-palco-text-secondary bg-palco-bg rounded-xl px-3 py-2">
          <span>🌿</span>
          <span>{uiText("Com perguntas mais aprofundadas")}</span>
          <span>🏆</span>
          <span>{uiText(", a tua voz ganha destaque.")}</span>
        </div>
      </div>
    </motion.div>
  );
}

// Palco Card for grid display
function PalcoCard({ palco, index }: { palco: Palco; index: number }) {
  useUiLocale();
  const navigate = useNavigate();
  const { selectedCurrency } = useCurrencyRates();

  // Format price with user's selected currency
  const formatPrice = (price: number) => {
    if (!selectedCurrency) return `$${price}`;
    // Prices are stored in USD, convert to local currency
    const localValue = price / selectedCurrency.rate_to_usd;
    return `${selectedCurrency.symbol}${Math.round(localValue)}`;
  };

  const getDateLabel = () => {
    if (!palco.roda?.scheduled_at) return null;
    const date = new Date(palco.roda.scheduled_at);
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, "d MMM", { locale: pt });
  };

  const getTimeLabel = () => {
    if (!palco.roda?.scheduled_at) return null;
    return format(new Date(palco.roda.scheduled_at), "HH:mm", { locale: pt });
  };

  // Build metadata parts, filtering out nulls
  const metaParts = [
    getDateLabel(),
    getTimeLabel(),
    palco.guide?.display_name
  ].filter(Boolean);

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => navigate(`/palco/${palco.id}`)}
      className="text-left bg-palco-surface rounded-[18px] overflow-hidden shadow-sm"
    >
      {/* Cover */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-palco-accent/10 to-palco-accent/5">
        {palco.cover_url ? (
          <img
            src={palco.cover_url}
            alt={palco.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PalcoIcon className="w-10 h-10 text-palco-accent/30" />
          </div>
        )}

        {/* Live badge */}
        {palco.status === 'live' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-destructive text-destructive-foreground rounded-full text-[10px] font-medium">
            <Radio className="w-2.5 h-2.5 animate-pulse" />{uiText("LIVE")}</div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Metadata line - only show if we have parts */}
        {metaParts.length > 0 && (
          <p className="text-[11px] text-palco-text-secondary mb-1.5 truncate">
            {metaParts.join(' • ')}
          </p>
        )}

        <h4 className="font-semibold text-[13px] leading-tight text-palco-text line-clamp-2 mb-2">
          {palco.title}
        </h4>

        {/* Voices available */}
        <p className="text-xs mb-2">
          <span className="text-palco-accent font-semibold">+{palco.total_voices || 17}{uiText(" Vozes")}</span>
          <span className="text-palco-text-secondary">{uiText(" Disponíveis")}</span>
        </p>

        {/* Price - single clear display */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-palco-text-secondary">{uiText("A partir de")}</span>
          <span className="text-base font-bold text-palco-accent">
            {formatPrice(palco.min_price || 1)}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

// Component for voice questions list with currency conversion
function VoiceQuestionsList({ palco }: { palco: Palco }) {
  useUiLocale();
  const { selectedCurrency } = useCurrencyRates();

  const formatPrice = (price: number) => {
    if (!selectedCurrency) return `$${price}`;
    // Prices are stored in USD, convert to local currency
    const localValue = price / selectedCurrency.rate_to_usd;
    return `${selectedCurrency.symbol}${Math.round(localValue)}`;
  };

  // Voice prices (1, 3, 5 USD base)
  const voicePrices = [1, 3, 5];

  return (
    <>
      {sampleQuestions.slice(0, 3).map((question, idx) => (
        <div key={idx} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-palco-text-secondary" />
            <span className="text-sm text-palco-text">{question}</span>
          </div>
          <span className="text-sm font-semibold text-palco-accent">
            {formatPrice(voicePrices[idx])}
          </span>
        </div>
      ))}
    </>
  );
}
