import { uiLocale, uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Plus,
  Radio,
  Clock,
  Users,
  MessageSquare,
  Play,
  Pause,
  Eye,
  Calendar,
  MoreVertical,
  Mic,
  Mail,
  Star,
  ChevronRight,
  Edit
} from 'lucide-react';
import { PalcoIcon } from '@/components/icons/PalcoIcon';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { usePalco, useRodasList, useCreateRoda, useStartRoda, useEndRoda, useVozes, useConfirmVozPayment, useMarkVozAnswered, Roda, Voz, Palco } from '@/hooks/usePalco';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from '@/i18n/ui-date';
import { pt } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { VozesPanel } from '@/components/palco/VozesPanel';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';
import { getCurrencyForCountry } from '@/lib/country-currency-map';

type TabView = 'rodas' | 'vozes' | 'stats';

export default function PalcoManage() {
  useUiLocale();
  const navigate = useNavigate();
  const { palcoId } = useParams<{ palcoId: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabView>('rodas');
  const [showCreateRoda, setShowCreateRoda] = useState(false);
  const [newRodaTitle, setNewRodaTitle] = useState('');
  const [newRodaDescription, setNewRodaDescription] = useState('');
  const [newRodaDate, setNewRodaDate] = useState('');
  const [selectedRodaId, setSelectedRodaId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);

  const { data: palco, isLoading: palcoLoading } = usePalco(palcoId);
  const { data: rodas, isLoading: rodasLoading } = useRodasList();
  const createRoda = useCreateRoda();

  // Get vozes for selected roda or first active roda
  const activeRoda = rodas?.find(r => r.phase === 'content' || r.phase === 'qa') || rodas?.[0];
  const currentRodaId = selectedRodaId || activeRoda?.id;
  const { data: vozes = [] } = useVozes(currentRodaId);

  const confirmPayment = useConfirmVozPayment();
  const markAnswered = useMarkVozAnswered();

  const isLoading = palcoLoading || rodasLoading;

  // Group rodas by status
  const liveRodas = rodas?.filter(r => r.phase === 'content' || r.phase === 'qa') || [];
  const scheduledRodas = rodas?.filter(r => r.phase === 'scheduled') || [];
  const endedRodas = rodas?.filter(r => r.phase === 'ended') || [];

  // Handlers for vozes
  const handleConfirmPayment = (vozId: string) => {
    if (!currentRodaId) return;
    setConfirmingId(vozId);
    confirmPayment.mutate({ vozId, rodaId: currentRodaId }, {
      onSettled: () => setConfirmingId(null),
    });
  };

  const handleMarkAnswered = (vozId: string) => {
    if (!currentRodaId) return;
    setAnsweringId(vozId);
    markAnswered.mutate({ vozId, rodaId: currentRodaId }, {
      onSettled: () => setAnsweringId(null),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-palco-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-palco-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!palco) {
    return (
      <div className="min-h-screen bg-palco-bg flex flex-col items-center justify-center p-4">
        <p className="text-palco-text-secondary mb-4">{uiText("Palco não encontrado")}</p>
        <Button onClick={() => navigate('/palco/dashboard')}>{uiText("Voltar ao Dashboard")}</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-palco-bg pb-20">
      {/* Header */}
      <header className="bg-palco-bg">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-palco-text hover:bg-palco-accent/10"
              onClick={() => navigate('/palco/dashboard')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex flex-col items-center">
              <YamilookLogo size="sm" showTagline={false} animate={false} className="opacity-90 scale-75" bgClassName="bg-palco-bg" />
              <div className="flex items-center gap-1 -mt-1">
                <PalcoIcon className="w-4 h-4 text-palco-accent" filled />
                <span className="text-base font-bold text-palco-text tracking-tight">PALCO</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-palco-text hover:bg-palco-accent/10"
              onClick={() => navigate(`/palco/${palcoId}/edit`)}
            >
              <Edit className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold text-palco-text text-center line-clamp-1 mb-1">
            {palco.title}
          </h1>
          <p className="text-xs text-palco-text-secondary text-center">{uiText("Gestão do Palco")}</p>
        </div>
        <div className="px-4 pb-4">

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2">
            <QuickStat
              label="Rodas"
              value={0}
              icon={<Calendar className="w-3.5 h-3.5" />}
            />
            <QuickStat
              label="Vozes"
              value={palco.total_voices || 0}
              icon={<MessageSquare className="w-3.5 h-3.5" />}
            />
            <QuickStat
              label="Ao Vivo"
              value={liveRodas.length}
              icon={<Radio className="w-3.5 h-3.5" />}
              highlight={liveRodas.length > 0}
            />
            <QuickStat
              label="Agendadas"
              value={scheduledRodas.length}
              icon={<Clock className="w-3.5 h-3.5" />}
            />
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabView)} className="mb-4">
          <TabsList className="grid w-full grid-cols-3 bg-palco-surface border border-palco-border rounded-full p-1">
            <TabsTrigger
              value="rodas"
              className="rounded-full data-[state=active]:bg-palco-accent data-[state=active]:text-white"
            >{uiText("Rodas")}</TabsTrigger>
            <TabsTrigger
              value="vozes"
              className="rounded-full data-[state=active]:bg-palco-accent data-[state=active]:text-white"
            >{uiText("Vozes")}</TabsTrigger>
            <TabsTrigger
              value="stats"
              className="rounded-full data-[state=active]:bg-palco-accent data-[state=active]:text-white"
            >{uiText("Estatísticas")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Tab Content */}
        {activeTab === 'rodas' && (
          <div className="space-y-4">
            {/* Create Roda Button */}
            <Button
              className="w-full bg-palco-accent hover:bg-palco-accent/90 text-white rounded-full"
              onClick={() => setShowCreateRoda(true)}
            >
              <Plus className="w-4 h-4 mr-2" />{uiText("Nova Roda")}</Button>

            {/* Live Rodas */}
            {liveRodas.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-palco-text mb-2 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-500 animate-pulse" />{uiText("Ao Vivo Agora")}</h3>
                <div className="space-y-2">
                  {liveRodas.map((roda, index) => (
                    <RodaManageCard key={roda.id} roda={roda} palcoId={palcoId!} index={index} />
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled Rodas */}
            {scheduledRodas.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-palco-text mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-palco-accent" />{uiText("Agendadas")}</h3>
                <div className="space-y-2">
                  {scheduledRodas.map((roda, index) => (
                    <RodaManageCard key={roda.id} roda={roda} palcoId={palcoId!} index={index} />
                  ))}
                </div>
              </div>
            )}

            {/* Ended Rodas */}
            {endedRodas.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-palco-text-secondary mb-2">{uiText("Terminadas")}</h3>
                <div className="space-y-2">
                  {endedRodas.slice(0, 5).map((roda, index) => (
                    <RodaManageCard key={roda.id} roda={roda} palcoId={palcoId!} index={index} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {rodas?.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-palco-accent/50" />
                <h3 className="text-lg font-medium text-palco-text mb-2">{uiText("Nenhuma roda ainda")}</h3>
                <p className="text-sm text-palco-text-secondary">{uiText("Crie a sua primeira roda para começar a receber vozes.")}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'vozes' && (
          <div className="space-y-4">
            {/* Roda Selector */}
            {rodas && rodas.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {rodas.map((r) => (
                  <Button
                    key={r.id}
                    variant={currentRodaId === r.id ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      "rounded-full whitespace-nowrap",
                      currentRodaId === r.id
                        ? "bg-palco-accent text-white"
                        : "border-palco-border text-palco-text"
                    )}
                    onClick={() => setSelectedRodaId(r.id)}
                  >
                    {r.title || uiText("Roda")}
                    {(r.phase === 'content' || r.phase === 'qa') && (
                      <Radio className="w-3 h-3 ml-1 text-red-400" />
                    )}
                  </Button>
                ))}
              </div>
            )}

            {/* Vozes List using VozesPanel */}
            <VozesPanel
              vozes={vozes}
              isGuide={true}
              onConfirmPayment={handleConfirmPayment}
              onMarkAnswered={handleMarkAnswered}
              confirmingId={confirmingId}
              answeringId={answeringId}
            />
          </div>
        )}

        {activeTab === 'stats' && (
          <StatsTabContent palco={palco} endedRodasCount={endedRodas.length} />
        )}
      </main>

      {/* Create Roda Sheet */}
      <Sheet open={showCreateRoda} onOpenChange={(open) => {
        setShowCreateRoda(open);
        if (!open) { setNewRodaTitle(''); setNewRodaDescription(''); setNewRodaDate(''); }
      }}>
        <SheetContent side="bottom" className="bg-palco-surface border-palco-border rounded-t-[24px]">
          <SheetHeader>
            <SheetTitle className="text-palco-text">{uiText("Nova Roda")}</SheetTitle>
          </SheetHeader>
          <div className="py-6 space-y-4">
            <div>
              <Label className="text-palco-text">{uiText("Título (opcional)")}</Label>
              <Input
                placeholder={uiText("Ex: Roda de Domingo")}
                value={newRodaTitle}
                onChange={(e) => setNewRodaTitle(e.target.value)}
                className="bg-palco-bg border-palco-border text-palco-text mt-2"
              />
            </div>
            <div>
              <Label className="text-palco-text">{uiText("Descrição ")}<span className="text-red-500">*</span></Label>
              <Textarea
                placeholder={uiText("Descreva o que as pessoas vão aprender...")}
                value={newRodaDescription}
                onChange={(e) => setNewRodaDescription(e.target.value)}
                className="bg-palco-bg border-palco-border text-palco-text mt-2 min-h-[100px]"
                maxLength={500}
              />
              <p className={cn(
                "text-xs mt-1",
                newRodaDescription.length < 20 ? "text-red-400" : "text-palco-text-secondary"
              )}>
                {newRodaDescription.length}/500 {newRodaDescription.length < 20 && uiText("(mínimo 20 caracteres)")}
              </p>
            </div>
            <div>
              <Label className="text-palco-text">{uiText("Data e Hora")}</Label>
              <Input
                type="datetime-local"
                value={newRodaDate}
                onChange={(e) => setNewRodaDate(e.target.value)}
                className="bg-palco-bg border-palco-border text-palco-text mt-2"
              />
            </div>
            <Button
              className="w-full bg-palco-accent hover:bg-palco-accent/90 text-white rounded-full"
              disabled={newRodaDescription.trim().length < 20 || createRoda.isPending}
              onClick={async () => {
                if (!palcoId || newRodaDescription.trim().length < 20) return;
                await createRoda.mutateAsync({
                  title: newRodaTitle || `Roda - ${palco?.title || ''}`,
                  description: newRodaDescription.trim(),
                  scheduled_at: newRodaDate || undefined,
                });
                setShowCreateRoda(false);
                setNewRodaTitle('');
                setNewRodaDescription('');
                setNewRodaDate('');
              }}
            >
              {createRoda.isPending ? uiText("A criar...") : uiText("Criar Roda")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav />
    </div>
  );
}

function QuickStat({
  label,
  value,
  icon,
  highlight = false
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  useUiLocale();
  return (
    <div className={cn(
      "bg-palco-surface rounded-[12px] border border-palco-border p-2 text-center",
      highlight && "border-red-500/50 bg-red-500/10"
    )}>
      <div className={cn(
        "flex items-center justify-center gap-1 mb-1",
        highlight ? "text-red-500" : "text-palco-text-secondary"
      )}>
        {icon}
      </div>
      <p className={cn(
        "text-lg font-semibold",
        highlight ? "text-red-500" : "text-palco-text"
      )}>{value}</p>
      <p className="text-[10px] text-palco-text-secondary">{label}</p>
    </div>
  );
}

function RodaManageCard({ roda, palcoId, index }: { roda: Roda; palcoId: string; index: number }) {
  useUiLocale();
  const navigate = useNavigate();
  const startRoda = useStartRoda();
  const endRoda = useEndRoda();
  const isLive = roda.phase === 'content' || roda.phase === 'qa';

  const handleStart = async () => {
    try {
      await startRoda.mutateAsync(roda.id);
      // Navigate to live view after starting
      navigate(`/palco/${palcoId}/roda/${roda.id}`);
    } catch (error) {
      console.error('Failed to start roda:', error);
    }
  };

  const handleEnd = async () => {
    try {
      await endRoda.mutateAsync(roda.id);
    } catch (error) {
      console.error('Failed to end roda:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "bg-palco-surface rounded-[14px] border p-3",
        isLive ? "border-red-500/50" : "border-palco-border"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isLive && (
              <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">{uiText("AO VIVO")}</Badge>
            )}
            <h4 className="text-sm font-medium text-palco-text">
              {roda.title || uiText("Roda sem título")}
            </h4>
          </div>
          <div className="flex items-center gap-3 text-xs text-palco-text-secondary">
            {roda.scheduled_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(roda.scheduled_at), "d MMM 'às' HH:mm", { locale: pt })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />{uiText("{{value1}} viewers", { value1: (roda.viewer_count) ?? "" })}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLive ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-palco-accent hover:bg-palco-accent/10 rounded-full"
                onClick={() => navigate(`/palco/${palcoId}/roda/${roda.id}`)}
              >
                <Eye className="w-4 h-4 mr-1" />{uiText("Ver")}</Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-500/10 rounded-full"
                onClick={handleEnd}
                disabled={endRoda.isPending}
              >
                <Pause className="w-4 h-4 mr-1" />
                {endRoda.isPending ? '...' : uiText("Parar")}
              </Button>
            </>
          ) : roda.phase === 'scheduled' ? (
            <Button
              size="sm"
              className="bg-green-500 hover:bg-green-600 text-white rounded-full"
              onClick={handleStart}
              disabled={startRoda.isPending}
            >
              <Play className="w-4 h-4 mr-1" />
              {startRoda.isPending ? uiText("A iniciar...") : uiText("Iniciar")}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-palco-text-secondary rounded-full"
              onClick={() => navigate(`/palco/${palcoId}/roda/${roda.id}/pool`)}
            >{uiText("Ver")}<ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function VozCard({ voz }: { voz: { id: string; type: string; status: string; user: string; time: string } }) {
  useUiLocale();
  const getTypeIcon = () => {
    switch (voz.type) {
      case 'email': return <Mail className="w-4 h-4 text-blue-500" />;
      case 'live': return <Mic className="w-4 h-4 text-green-500" />;
      case 'highlight': return <Star className="w-4 h-4 text-palco-accent" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getStatusBadge = () => {
    switch (voz.status) {
      case 'pending':
        return <Badge variant="outline" className="text-orange-500 border-orange-500">{uiText("Pendente")}</Badge>;
      case 'paid':
        return <Badge className="bg-green-500 text-white">{uiText("Pago")}</Badge>;
      case 'queued':
        return <Badge variant="outline" className="text-palco-accent border-palco-accent">{uiText("Na Fila")}</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-palco-surface rounded-[14px] border border-palco-border p-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-palco-accent/10 flex items-center justify-center">
          {getTypeIcon()}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-medium text-palco-text">{voz.user}</h4>
            {getStatusBadge()}
          </div>
          <p className="text-xs text-palco-text-secondary">{voz.time}</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Stats Tab Content with currency conversion based on Palco location
function StatsTabContent({ palco, endedRodasCount }: { palco: Palco; endedRodasCount: number }) {
  useUiLocale();
  const { currencies } = useCurrencyRates();

  // Get currency based on Palco's location (country code from location string)
  const getPalcoCurrency = () => {
    // Try to extract country code from palco.location
    // The location could be country name like "Angola" or code like "AO"
    const locationToCountryCode: Record<string, string> = {
      'Angola': 'AO',
      'South Africa': 'ZA',
      'Mozambique': 'MZ',
      'Nigeria': 'NG',
      'Kenya': 'KE',
      // Add more as needed
    };

    const countryCode = locationToCountryCode[palco.location] || palco.location;
    const currencyCode = getCurrencyForCountry(countryCode);

    // Find currency details from the rates table
    const currency = currencies.find(c => c.currency_code === currencyCode);
    return currency || { symbol: '$', rate_to_usd: 1, currency_code: 'USD' };
  };

  const palcoCurrency = getPalcoCurrency();

  // Format price with Palco's location-based currency
  const formatPrice = (usdPrice: number) => {
    const localValue = usdPrice / palcoCurrency.rate_to_usd;
    return `${palcoCurrency.symbol}${Math.round(localValue).toLocaleString(uiLocale())}`;
  };

  const totalRevenue = (palco.total_voices || 0) * (palco.min_price || 5);

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatsCard
          label="Total de Vozes"
          value={palco.total_voices || 0}
          change="+12%"
        />
        <StatsCard
          label="Rodas Realizadas"
          value={endedRodasCount}
          change="+5%"
        />
        <StatsCard
          label="Taxa de Conversão"
          value="68%"
          change="+3%"
        />
        <StatsCard
          label="Receita Total"
          value={formatPrice(totalRevenue)}
          change="+18%"
        />
      </div>

      {/* Voice Types Breakdown */}
      <div className="bg-palco-surface rounded-[16px] border border-palco-border p-4">
        <h3 className="text-sm font-medium text-palco-text mb-4">{uiText("Tipos de Voz")}</h3>
        <div className="space-y-3">
          <VoiceTypeBar label="Email" icon={<Mail className="w-4 h-4" />} value={45} color="bg-blue-500" />
          <VoiceTypeBar label="Live" icon={<Mic className="w-4 h-4" />} value={35} color="bg-green-500" />
          <VoiceTypeBar label="Highlight" icon={<Star className="w-4 h-4" />} value={20} color="bg-palco-accent" />
        </div>
      </div>
    </div>
  );
}

function StatsCard({ label, value, change }: { label: string; value: string | number; change: string }) {
  useUiLocale();
  const isPositive = change.startsWith('+');

  return (
    <div className="bg-palco-surface rounded-[16px] border border-palco-border p-4">
      <p className="text-xs text-palco-text-secondary mb-1">{label}</p>
      <p className="text-2xl font-semibold text-palco-text">{value}</p>
      <p className={cn(
        "text-xs mt-1",
        isPositive ? "text-green-500" : "text-red-500"
      )}>{uiText("{{value1}} vs. mês anterior", { value1: (change) ?? "" })}</p>
    </div>
  );
}

function VoiceTypeBar({ label, icon, value, color }: { label: string; icon: React.ReactNode; value: number; color: string }) {
  useUiLocale();
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm text-palco-text">{label}</span>
        </div>
        <span className="text-sm text-palco-text-secondary">{value}%</span>
      </div>
      <div className="w-full h-2 bg-palco-bg rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
