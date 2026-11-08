import { uiLocale, uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Megaphone,
  Plus,
  TrendingUp,
  Eye,
  MousePointer,
  Coins,
  Building2,
  BarChart3,
  Pause,
  Play,
  Trash2,
  Settings,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Send,
  AlertCircle
} from 'lucide-react';
import { useAdvertising, Advertisement, BusinessProfile } from '@/hooks/useAdvertising';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';
import { BusinessProfileSetup } from './BusinessProfileSetup';
import { CreateAdSheet } from './CreateAdSheet';
import { AdPreviewDialog } from './AdPreviewDialog';
import { StatsDetailSheet } from './StatsDetailSheet';
import { CreditDisplay } from './CreditDisplay';
import { BuyCreditsSheet } from './BuyCreditsSheet';
import { format } from '@/i18n/ui-date';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdsDashboardProps {
  onBack?: () => void;
}

type StatType = 'credits' | 'ads' | 'impressions' | 'clicks';

export function AdsDashboard({ onBack }: AdsDashboardProps) {
  useUiLocale();
  const {
    businessProfile,
    advertisements,
    creditTransactions,
    loading,
    pauseAdvertisement,
    activateAdvertisement,
    deleteAdvertisement,
    addCredits,
    fetchBusinessProfile
  } = useAdvertising();

  const [showBusinessSetup, setShowBusinessSetup] = useState(false);
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [activeTab, setActiveTab] = useState('ads');
  const [previewAd, setPreviewAd] = useState<Advertisement | null>(null);
  const [selectedStat, setSelectedStat] = useState<StatType | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const [promotePostId, setPromotePostId] = useState<string | null>(null);

  // Deep link from a post's "Promover" action: /advertising?promote=<postId>
  useEffect(() => {
    const p = searchParams.get('promote');
    if (p && businessProfile) {
      setPromotePostId(p);
      setShowCreateAd(true);
    }
  }, [searchParams, businessProfile]);

  // Reconcile pending AppyPay payments whenever the dashboard opens — a REF paid
  // at the ATM (or a delayed Multicaixa push) is confirmed by querying the charge
  // status, since AppyPay's webhook isn't reliably delivered.
  useEffect(() => {
    if (!businessProfile?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.functions.invoke('check-appypay-payment', { body: {} });
      if (!cancelled && (data as { credited?: number })?.credited) {
        toast.success(uiText("Pagamento confirmado! Créditos adicionados. ✅"));
        fetchBusinessProfile();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessProfile?.id]);

  const activeAds = advertisements.filter(a => a.status === 'active');
  const totalImpressions = advertisements.reduce((sum, a) => sum + a.impressions, 0);
  const totalClicks = advertisements.reduce((sum, a) => sum + a.clicks, 0);
  const totalSpent = advertisements.reduce((sum, a) => sum + a.spent_credits, 0);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      active: { variant: 'default', label: uiText("Ativo") },
      paused: { variant: 'secondary', label: uiText("Pausado") },
      draft: { variant: 'outline', label: uiText("Rascunho") },
      pending_review: { variant: 'secondary', label: uiText("Em revisão") },
      completed: { variant: 'secondary', label: uiText("Concluído") },
      rejected: { variant: 'destructive', label: uiText("Rejeitado") },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // No business profile - show onboarding
  if (!loading && !businessProfile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b safe-top">
          <div className="flex items-center gap-3 px-4 py-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <h1 className="text-xl font-bold">{uiText("Yamilook Ads")}</h1>
          </div>
        </div>

        <div className="p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Megaphone className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{uiText("Promove o teu negócio")}</h2>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">{uiText("Alcança clientes perto de ti com anúncios hiperlocais no Yamilook")}</p>

            <div className="grid grid-cols-3 gap-4 mb-8 max-w-sm mx-auto text-center">
              <div>
                <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Eye className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">{uiText("Visibilidade local")}</p>
              </div>
              <div>
                <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">{uiText("Público certo")}</p>
              </div>
              <div>
                <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">{uiText("Resultados reais")}</p>
              </div>
            </div>

            <Button size="lg" onClick={() => setShowBusinessSetup(true)} className="px-8">
              <Building2 className="w-5 h-5 mr-2" />{uiText("Começar agora")}</Button>

            <p className="text-xs text-muted-foreground mt-4">
              <Sparkles className="w-3 h-3 inline mr-1" />{uiText("500 créditos grátis para novos negócios")}</p>
          </motion.div>
        </div>

        <BusinessProfileSetup
          open={showBusinessSetup}
          onOpenChange={setShowBusinessSetup}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="text-xl font-bold">{uiText("Yamilook Ads")}</h1>
              <p className="text-xs text-muted-foreground">{businessProfile?.business_name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowBusinessSetup(true)}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <Card
          className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] col-span-2"
          onClick={() => setSelectedStat('credits')}
        >
          <CreditDisplay
            credits={businessProfile?.credit_balance || 0}
            size="md"
            showSelector={true}
            showEquivalent={true}
          />
        </Card>

        <Button
          onClick={() => setBuyOpen(true)}
          className="col-span-2 h-11 rounded-xl gap-2"
        >
          <Plus className="w-4 h-4" />{uiText(" Comprar créditos")}</Button>

        <Card
          className="p-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
          onClick={() => setSelectedStat('ads')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeAds.length}</p>
              <p className="text-xs text-muted-foreground">{uiText("Anúncios ativos")}</p>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
          onClick={() => setSelectedStat('impressions')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalImpressions.toLocaleString(uiLocale())}</p>
              <p className="text-xs text-muted-foreground">{uiText("Impressões")}</p>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
          onClick={() => setSelectedStat('clicks')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
              <MousePointer className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalClicks.toLocaleString(uiLocale())}</p>
              <p className="text-xs text-muted-foreground">{uiText("Cliques")}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
        <TabsList className="w-full">
          <TabsTrigger value="ads" className="flex-1">{uiText("Anúncios")}</TabsTrigger>
          <TabsTrigger value="credits" className="flex-1">{uiText("Créditos")}</TabsTrigger>
        </TabsList>

        <TabsContent value="ads" className="mt-4">
          {advertisements.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">{uiText("Ainda não criaste anúncios")}</p>
              <Button onClick={() => setShowCreateAd(true)}>
                <Plus className="w-4 h-4 mr-2" />{uiText("Criar primeiro anúncio")}</Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px]" type="always">
              <div className="space-y-3 pr-4">
                {advertisements.map((ad) => (
                  <motion.div
                    key={ad.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusBadge(ad.status)}
                            <Badge
                              variant={previewAd?.id === ad.id ? "default" : "outline"}
                              className={`text-xs cursor-pointer transition-colors ${
                                previewAd?.id === ad.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-secondary'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewAd(ad);
                              }}
                            >
                              {ad.ad_type === 'promoted_post' ? uiText("Post") : uiText("Perfil")}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium truncate">
                            {ad.title || uiText("Anúncio sem título")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ad.target_city}{ad.target_neighborhood ? ` - ${ad.target_neighborhood}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-3 text-center">
                        <div>
                          <p className="text-lg font-semibold">{ad.impressions}</p>
                          <p className="text-xs text-muted-foreground">{uiText("Impressões")}</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{ad.clicks}</p>
                          <p className="text-xs text-muted-foreground">{uiText("Cliques")}</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{ad.spent_credits}</p>
                          <p className="text-xs text-muted-foreground">{uiText("Gasto")}</p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>{uiText("Orçamento usado")}</span>
                          <span>{Math.round((ad.spent_credits / ad.total_budget) * 100)}%</span>
                        </div>
                        <Progress value={(ad.spent_credits / ad.total_budget) * 100} className="h-2" />
                      </div>

                      <div className="flex gap-2">
                        {ad.status === 'active' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => pauseAdvertisement(ad.id)}
                          >
                            <Pause className="w-4 h-4 mr-1" />{uiText("Pausar")}</Button>
                        ) : ad.status === 'paused' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => activateAdvertisement(ad.id)}
                          >
                            <Play className="w-4 h-4 mr-1" />{uiText("Retomar")}</Button>
                        ) : ad.status === 'draft' ? (
                          <Button
                            size="sm"
                            className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                            onClick={() => setPreviewAd(ad)}
                          >
                            <Zap className="w-4 h-4 mr-1" />{uiText("Ativar Destaque")}</Button>
                        ) : ad.status === 'pending_review' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            disabled
                          >
                            <AlertCircle className="w-4 h-4 mr-1" />{uiText("Em análise")}</Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAdvertisement(ad.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="credits" className="mt-4">
          <Card className="p-4 mb-4 bg-gradient-to-r from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <CreditDisplay
                credits={businessProfile?.credit_balance || 0}
                size="lg"
                showSelector={true}
                showEquivalent={true}
              />
              <Button onClick={() => addCredits(100, 'Créditos de teste')}>
                <Plus className="w-4 h-4 mr-2" />{uiText("Adicionar")}</Button>
            </div>
          </Card>

          <h3 className="font-semibold mb-3">{uiText("Histórico")}</h3>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {creditTransactions.map((tx) => (
                <Card key={tx.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tx.description || tx.transaction_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), "d MMM, HH:mm", { locale: pt })}
                      </p>
                    </div>
                    <span className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* FAB */}
      <Button
        size="lg"
        className="fixed bottom-24 right-4 rounded-full w-14 h-14 shadow-lg"
        onClick={() => setShowCreateAd(true)}
      >
        <Plus className="w-6 h-6" />
      </Button>

      <BusinessProfileSetup
        open={showBusinessSetup}
        onOpenChange={setShowBusinessSetup}
      />

      <CreateAdSheet
        open={showCreateAd}
        onOpenChange={(o) => { setShowCreateAd(o); if (!o) setPromotePostId(null); }}
        preselectedPostId={promotePostId ?? undefined}
      />

      {previewAd && (
        <AdPreviewDialog
          open={!!previewAd}
          onOpenChange={(open) => !open && setPreviewAd(null)}
          ad={previewAd}
          businessProfile={businessProfile}
          onConfirmActivate={() => activateAdvertisement(previewAd.id)}
          onViewCredits={() => {
            setPreviewAd(null);
            setSelectedStat('credits');
          }}
          onViewBudget={() => {
            setPreviewAd(null);
            setSelectedStat('ads');
          }}
        />
      )}

      {selectedStat && (
        <StatsDetailSheet
          open={!!selectedStat}
          onOpenChange={(open) => !open && setSelectedStat(null)}
          statType={selectedStat}
          businessProfile={businessProfile}
          advertisements={advertisements}
          creditTransactions={creditTransactions}
          onAdClick={(ad) => {
            setSelectedStat(null);
            setPreviewAd({ ...ad, business: businessProfile || undefined });
          }}
        />
      )}

      <BuyCreditsSheet open={buyOpen} onOpenChange={setBuyOpen} onDone={fetchBusinessProfile} />
    </div>
  );
}

// Missing import
function Target(props: React.SVGProps<SVGSVGElement>) {
  useUiLocale();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
