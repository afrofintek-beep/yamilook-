import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Radio,
  Clock,
  Users,
  MessageSquare,
  TrendingUp,
  ChevronRight,
  MoreVertical,
  Calendar,
  Settings,
  Eye,
  Edit,
  Archive,
  Sparkles
} from 'lucide-react';
import { PalcoIcon } from '@/components/icons/PalcoIcon';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { useMyPalcos, Palco } from '@/hooks/usePalco';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';

type TabFilter = 'active' | 'scheduled' | 'archived';

export default function GuideDashboard() {
  useUiLocale();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabFilter>('active');

  const { data: palcos, isLoading } = useMyPalcos();

  // Filter palcos for tabs.
  // NOTE: Some palcos can remain in 'draft' even after creating/adding Rodas.
  // For the dashboard UX, consider them 'scheduled' if they already have Rodas.
  const isEffectivelyScheduled = (p: Palco) =>
    p.status === 'scheduled' || (p.status === 'draft' && p.roda_id != null);

  const activePalcos = palcos?.filter(p => p.status === 'live') || [];

  // Sort scheduled palcos by roda date (soonest first)
  const scheduledPalcos = (palcos?.filter(isEffectivelyScheduled) || []).sort((a, b) => {
    const aDate = a.roda?.scheduled_at;
    const bDate = b.roda?.scheduled_at;
    if (aDate && bDate) return new Date(aDate).getTime() - new Date(bDate).getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    return 0;
  });

  const archivedPalcos = palcos?.filter(p => p.status === 'ended' || p.status === 'archived') || [];

  // Calculate summary stats
  const totalVoices = palcos?.reduce((sum, p) => sum + (p.total_voices || 0), 0) || 0;
  const totalPalcos = palcos?.length || 0;
  const livePalcos = palcos?.filter(p => p.status === 'live').length || 0;

  const getFilteredPalcos = () => {
    switch (activeTab) {
      case 'active':
        return activePalcos;
      case 'scheduled':
        return scheduledPalcos;
      case 'archived':
        return archivedPalcos;
      default:
        return palcos || [];
    }
  };

  const filteredPalcos = getFilteredPalcos();

  return (
    <div className="min-h-screen bg-palco-bg pb-20">
      {/* Header */}
      <header className="bg-palco-bg">
        <div className="px-4 pt-4 pb-2">
          {/* Yamilook Logo + PALCO branding */}
          <div className="flex flex-col items-center mb-4">
            <YamilookLogo size="sm" showTagline={false} animate={false} className="opacity-90" bgClassName="bg-palco-bg" />
            <div className="flex items-center gap-1.5 mt-1">
              <PalcoIcon className="w-5 h-5 text-palco-accent" filled />
              <span className="text-xl font-bold text-palco-text tracking-tight">PALCO</span>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-4">
            <button
              className="flex items-center gap-3 text-left"
              onClick={() => user?.id && navigate(`/profile/${user.id}`)}
            >
              <Avatar className="w-11 h-11 ring-2 ring-palco-accent/30 transition-transform hover:scale-105">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-palco-accent text-palco-surface">
                  {profile?.display_name?.[0] || 'G'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-lg font-semibold text-palco-text">
                  {profile?.display_name
                    ? t('palco.guideGreetingWithName', { name: profile.display_name })
                    : t('palco.guideGreeting')}
                </h1>
                <p className="text-sm text-palco-text-secondary">
                  {t('palco.guideStats')}
                </p>
              </div>
            </button>
            <Button
              size="icon"
              className="bg-palco-accent text-palco-surface hover:bg-palco-accent/90 rounded-full shadow-sm"
              onClick={() => navigate('/palco/create')}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<MessageSquare className="w-4 h-4" />}
              label="Vozes"
              value={totalVoices}
              color="accent"
            />
            <StatCard
              icon={<Calendar className="w-4 h-4" />}
              label="Palcos"
              value={totalPalcos}
              color="accent"
            />
            <StatCard
              icon={<Radio className="w-4 h-4" />}
              label="Ao Vivo"
              value={livePalcos}
              color="accent"
            />
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)} className="mb-4">
          <TabsList className="grid w-full grid-cols-3 bg-palco-surface/60 rounded-full p-1">
            <TabsTrigger
              value="active"
              className="rounded-full data-[state=active]:bg-palco-accent data-[state=active]:text-palco-surface data-[state=active]:shadow-sm"
            >{uiText("Ativos (")}{activePalcos.length})
            </TabsTrigger>
            <TabsTrigger
              value="scheduled"
              className="rounded-full data-[state=active]:bg-palco-accent data-[state=active]:text-palco-surface data-[state=active]:shadow-sm"
            >{uiText("Agendados (")}{scheduledPalcos.length})
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="rounded-full data-[state=active]:bg-palco-accent data-[state=active]:text-palco-surface data-[state=active]:shadow-sm"
            >{uiText("Arquivo (")}{archivedPalcos.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Palcos List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-palco-accent border-t-transparent rounded-full mx-auto" />
            </div>
          ) : filteredPalcos.length === 0 ? (
            <EmptyState tab={activeTab} onCreateClick={() => navigate('/palco/create')} />
          ) : (
            filteredPalcos.map((palco, index) => (
              <PalcoManageCard key={palco.id} palco={palco} index={index} />
            ))
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'accent' | 'blue' | 'red';
}) {
  useUiLocale();
  return (
    <div className="bg-palco-surface/70 rounded-[16px] p-3 shadow-sm">
      <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2 bg-palco-accent/10 text-palco-accent">
        {icon}
      </div>
      <p className="text-xl font-semibold text-palco-text">{value}</p>
      <p className="text-xs text-palco-text-secondary">{label}</p>
    </div>
  );
}

function PalcoManageCard({ palco, index }: { palco: Palco; index: number }) {
  useUiLocale();
  const navigate = useNavigate();
  const { selectedCurrency, creditsToMoney } = useCurrencyRates();

  // Format price with user's selected currency
  const formatPrice = (price: number) => {
    if (!selectedCurrency) return `$${price}`;
    // Prices are stored in USD, convert to local currency
    const localValue = price / selectedCurrency.rate_to_usd;
    return `${selectedCurrency.symbol}${Math.round(localValue)}`;
  };

  const getStatusBadge = () => {
    // Align badge with dashboard tab logic
    const effectiveStatus: Palco['status'] =
      palco.status === 'draft' && palco.roda_id != null ? 'scheduled' : palco.status;

    switch (effectiveStatus) {
      case 'live':
        return (
          <Badge className="bg-destructive text-destructive-foreground gap-1">
            <Radio className="w-3 h-3 animate-pulse" />{uiText("AO VIVO")}</Badge>
        );
      case 'scheduled':
        return (
          <Badge className="bg-palco-accent/20 text-palco-accent gap-1 border-0">
            <Clock className="w-3 h-3" />{uiText("Agendado")}</Badge>
        );
      case 'ended':
        return (
          <Badge variant="secondary" className="bg-palco-bg text-palco-text-secondary">{uiText("Terminado")}</Badge>
        );
      case 'archived':
        return (
          <Badge variant="secondary" className="bg-palco-bg text-palco-text-secondary">{uiText("Arquivado")}</Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-palco-bg text-palco-text-secondary">{uiText("Rascunho")}</Badge>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-palco-surface/80 rounded-[18px] overflow-hidden shadow-sm"
    >
      {/* Header with image */}
      <div className="relative h-24 bg-gradient-to-br from-palco-accent/20 to-palco-accent/5">
        {palco.cover_url && (
          <img
            src={palco.cover_url}
            alt={palco.title}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute top-2 left-2">
          {getStatusBadge()}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 w-8 h-8 bg-black/30 backdrop-blur-sm text-white hover:bg-black/50"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-palco-surface">
            <DropdownMenuItem
              onClick={() => navigate(`/palco/${palco.id}`)}
              className="text-palco-text"
            >
              <Eye className="w-4 h-4 mr-2" />{uiText("Ver Palco")}</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(`/palco/${palco.id}/edit`)}
              className="text-palco-text"
            >
              <Edit className="w-4 h-4 mr-2" />{uiText("Editar")}</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(`/palco/${palco.id}/manage`)}
              className="text-palco-text"
            >
              <Settings className="w-4 h-4 mr-2" />{uiText("Gerir")}</DropdownMenuItem>
            <DropdownMenuItem className="text-palco-text-secondary">
              <Archive className="w-4 h-4 mr-2" />{uiText("Arquivar")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-palco-text mb-1 line-clamp-1">{palco.title}</h3>
        {palco.theme && (
          <p className="text-xs text-palco-text-secondary mb-3">{palco.theme}</p>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-4 mb-3 text-xs text-palco-text-secondary">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            {palco.total_voices || 0} {(palco.total_voices || 0) === 1 ? uiText("Voz") : uiText("Vozes")}
          </span>
          {palco.roda && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {palco.roda.title}
            </span>
          )}
          <span className="flex items-center gap-1 font-medium text-palco-accent">
            {formatPrice(palco.min_price || 1)}+
          </span>
        </div>

        {/* Roda Info */}
        {palco.roda?.scheduled_at && (() => {
          const scheduledDate = new Date(palco.roda.scheduled_at);
          const hoursUntil = (scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60);
          const isSoon = hoursUntil > 0 && hoursUntil <= 24;
          const isPast = hoursUntil <= 0;
          return (
            <div className={cn(
              "flex items-center gap-2 p-2.5 rounded-[12px] mb-3",
              isSoon ? "bg-green-500/15" : isPast ? "bg-destructive/10" : "bg-palco-accent/10"
            )}>
              <Clock className={cn(
                "w-4 h-4",
                isSoon ? "text-green-600" : isPast ? "text-destructive" : "text-palco-accent"
              )} />
              <div className="flex-1">
                <span className={cn(
                  "text-xs font-medium",
                  isSoon ? "text-green-700" : isPast ? "text-destructive" : "text-palco-text"
                )}>
                  {format(scheduledDate, "d MMM 'às' HH:mm", { locale: pt })}
                </span>
                <span className="text-[10px] text-palco-text-secondary ml-2">
                  {formatDistanceToNow(scheduledDate, { locale: pt, addSuffix: true })}
                </span>
              </div>
              {isSoon && (
                <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 border-0">{uiText("Em breve")}</Badge>
              )}
            </div>
          );
        })()}

        {/* Action Button */}
        <Button
          className="w-full bg-palco-accent hover:bg-palco-accent/90 text-palco-surface rounded-full"
          onClick={() => navigate(`/palco/${palco.id}/manage`)}
        >{uiText("Gerir Palco")}<ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}

function EmptyState({ tab, onCreateClick }: { tab: TabFilter; onCreateClick: () => void }) {
  useUiLocale();
  const messages = {
    active: {
      title: uiText("Nenhum palco ativo"),
      description: uiText("Crie o seu primeiro palco para começar a receber vozes."),
      showButton: true,
    },
    scheduled: {
      title: uiText("Nenhuma roda agendada"),
      description: uiText("Agende uma roda nos seus palcos existentes."),
      showButton: false,
    },
    archived: {
      title: uiText("Nenhum palco arquivado"),
      description: uiText("Os palcos terminados aparecerão aqui."),
      showButton: false,
    },
  };

  const content = messages[tab];

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-palco-accent/10 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-palco-accent" />
      </div>
      <h3 className="text-lg font-medium text-palco-text mb-2">
        {content.title}
      </h3>
      <p className="text-sm text-palco-text-secondary mb-4">
        {content.description}
      </p>
      {content.showButton && (
        <Button
          className="bg-palco-accent text-palco-surface rounded-full"
          onClick={onCreateClick}
        >
          <Plus className="w-4 h-4 mr-2" />{uiText("Abrir Banda ao Vivo")}</Button>
      )}
    </div>
  );
}
