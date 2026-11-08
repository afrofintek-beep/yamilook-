import { uiLocale, uiText, useUiLocale } from '@/i18n/ui-copy';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Coins,
  Megaphone,
  Eye,
  MousePointer,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowRight,
  BarChart3,
  Target,
  Zap,
  ChevronRight
} from 'lucide-react';
import { Advertisement, BusinessProfile, CreditTransaction } from '@/hooks/useAdvertising';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';
import { CreditDisplay } from './CreditDisplay';
import { CurrencySelector } from './CurrencySelector';
import { format } from '@/i18n/ui-date';
import { pt } from 'date-fns/locale';

type StatType = 'credits' | 'ads' | 'impressions' | 'clicks';

interface StatsDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statType: StatType;
  businessProfile: BusinessProfile | null;
  advertisements: Advertisement[];
  creditTransactions: CreditTransaction[];
  onAdClick?: (ad: Advertisement) => void;
}

export function StatsDetailSheet({
  open,
  onOpenChange,
  statType,
  businessProfile,
  advertisements,
  creditTransactions,
  onAdClick
}: StatsDetailSheetProps) {
  useUiLocale();

  const {
    currencies,
    selectedCurrency,
    referenceCurrencies,
    localCurrencies,
    formatMoney,
    changeCurrency
  } = useCurrencyRates();

  const activeAds = advertisements.filter(a => a.status === 'active');
  const totalImpressions = advertisements.reduce((sum, a) => sum + a.impressions, 0);
  const totalClicks = advertisements.reduce((sum, a) => sum + a.clicks, 0);
  const totalSpent = advertisements.reduce((sum, a) => sum + a.spent_credits, 0);

  // Calculate CTR (Click Through Rate)
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  // Get recent transactions
  const recentTransactions = creditTransactions.slice(0, 5);

  // Sort ads by performance metric
  const adsByImpressions = [...advertisements].sort((a, b) => b.impressions - a.impressions);
  const adsByClicks = [...advertisements].sort((a, b) => b.clicks - a.clicks);

  const getTitle = () => {
    switch (statType) {
      case 'credits': return 'Detalhes de Créditos';
      case 'ads': return 'Anúncios Ativos';
      case 'impressions': return 'Detalhes de Impressões';
      case 'clicks': return 'Detalhes de Cliques';
    }
  };

  const getIcon = () => {
    switch (statType) {
      case 'credits': return <Coins className="w-5 h-5 text-primary" />;
      case 'ads': return <Megaphone className="w-5 h-5 text-primary" />;
      case 'impressions': return <Eye className="w-5 h-5 text-primary" />;
      case 'clicks': return <MousePointer className="w-5 h-5 text-primary" />;
    }
  };

  const renderCreditsContent = () => (
    <div className="space-y-4">
      {/* Currency Selector */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{uiText("Moeda de referência")}</span>
        <CurrencySelector
          currencies={currencies}
          selectedCurrency={selectedCurrency}
          referenceCurrencies={referenceCurrencies}
          localCurrencies={localCurrencies}
          onCurrencyChange={changeCurrency}
        />
      </div>

      {/* Balance Overview */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="text-center mb-4">
          <CreditDisplay
            credits={businessProfile?.credit_balance || 0}
            size="lg"
            showSelector={false}
            showEquivalent={true}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold">{totalSpent}</p>
            <p className="text-xs text-muted-foreground">{uiText("Gastos ({{value1}})", { value1: (formatMoney(totalSpent)) ?? "" })}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{advertisements.length}</p>
            <p className="text-xs text-muted-foreground">{uiText("Anúncios criados")}</p>
          </div>
        </div>
      </Card>

      {/* Credit Efficiency */}
      <Card className="p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />{uiText("Eficiência de Créditos")}</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{uiText("Custo por impressão")}</span>
            <div className="text-right">
              <span className="font-medium block">{uiText("{{value1}} créditos", { value1: (totalImpressions > 0 ? (totalSpent / totalImpressions).toFixed(3) : '0') ?? "" })}</span>
              <span className="text-xs text-muted-foreground">
                ≈ {totalImpressions > 0 ? formatMoney(totalSpent / totalImpressions) : formatMoney(0)}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{uiText("Custo por clique")}</span>
            <div className="text-right">
              <span className="font-medium block">{uiText("{{value1}} créditos", { value1: (totalClicks > 0 ? (totalSpent / totalClicks).toFixed(2) : '0') ?? "" })}</span>
              <span className="text-xs text-muted-foreground">
                ≈ {totalClicks > 0 ? formatMoney(totalSpent / totalClicks) : formatMoney(0)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Transactions */}
      <div>
        <h4 className="font-medium mb-3">{uiText("Últimas Transações")}</h4>
        <div className="space-y-2">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx) => (
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
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{uiText("Sem transações recentes")}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderAdsContent = () => (
    <div className="space-y-4">
      {/* Active Ads Summary */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="text-center mb-4">
          <p className="text-4xl font-bold text-primary">{activeAds.length}</p>
          <p className="text-sm text-muted-foreground">{uiText("Anúncios ativos")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-semibold">{advertisements.filter(a => a.status === 'paused').length}</p>
            <p className="text-xs text-muted-foreground">{uiText("Pausados")}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{advertisements.filter(a => a.status === 'draft').length}</p>
            <p className="text-xs text-muted-foreground">{uiText("Rascunhos")}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{advertisements.filter(a => a.status === 'pending_review').length}</p>
            <p className="text-xs text-muted-foreground">{uiText("Em revisão")}</p>
          </div>
        </div>
      </Card>

      {/* Performance by Ad */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />{uiText("Desempenho por Anúncio")}</h4>
        <div className="space-y-3">
          {activeAds.length > 0 ? (
            activeAds.map((ad) => (
              <Card
                key={ad.id}
                className="p-3 cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.98]"
                onClick={() => onAdClick?.(ad)}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium truncate flex-1">{ad.title || uiText("Sem título")}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="ml-2">{uiText("Ativo")}</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="font-semibold">{ad.impressions}</p>
                    <p className="text-muted-foreground">{uiText("Impressões")}</p>
                  </div>
                  <div>
                    <p className="font-semibold">{ad.clicks}</p>
                    <p className="text-muted-foreground">{uiText("Cliques")}</p>
                  </div>
                  <div>
                    <p className="font-semibold">{ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0'}%</p>
                    <p className="text-muted-foreground">{uiText("CTR")}</p>
                  </div>
                </div>
                <Progress
                  value={(ad.spent_credits / ad.total_budget) * 100}
                  className="h-1 mt-2"
                />
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{uiText("Nenhum anúncio ativo")}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderImpressionsContent = () => (
    <div className="space-y-4">
      {/* Impressions Overview */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="text-center mb-4">
          <p className="text-4xl font-bold text-primary">{totalImpressions.toLocaleString(uiLocale())}</p>
          <p className="text-sm text-muted-foreground">{uiText("Total de impressões")}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold">{ctr}%</p>
            <p className="text-xs text-muted-foreground">{uiText("Taxa de cliques (CTR)")}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">
              {totalImpressions > 0 ? (totalSpent / totalImpressions * 1000).toFixed(2) : '0'}
            </p>
            <p className="text-xs text-muted-foreground">{uiText("CPM (custo/1000)")}</p>
          </div>
        </div>
      </Card>

      {/* Top Performing Ads by Impressions */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4" />{uiText("Anúncios com Mais Impressões")}</h4>
        <div className="space-y-2">
          {adsByImpressions.slice(0, 5).map((ad, index) => (
            <Card
              key={ad.id}
              className="p-3 cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.98]"
              onClick={() => onAdClick?.(ad)}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ad.title || uiText("Sem título")}</p>
                  <p className="text-xs text-muted-foreground">
                    {ad.target_city}{ad.target_neighborhood ? ` - ${ad.target_neighborhood}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{ad.impressions.toLocaleString(uiLocale())}</p>
                  <p className="text-xs text-muted-foreground">{uiText("impressões")}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Tips */}
      <Card className="p-4 bg-secondary/50">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium mb-1">{uiText("Dica para aumentar impressões")}</p>
            <p className="text-xs text-muted-foreground">{uiText("Aumentar o orçamento diário e expandir a área de segmentação pode ajudar a alcançar mais pessoas.")}</p>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderClicksContent = () => (
    <div className="space-y-4">
      {/* Clicks Overview */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="text-center mb-4">
          <p className="text-4xl font-bold text-primary">{totalClicks.toLocaleString(uiLocale())}</p>
          <p className="text-sm text-muted-foreground">{uiText("Total de cliques")}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold">{ctr}%</p>
            <p className="text-xs text-muted-foreground">{uiText("Taxa de cliques (CTR)")}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">
              {totalClicks > 0 ? (totalSpent / totalClicks).toFixed(2) : '0'}
            </p>
            <p className="text-xs text-muted-foreground">{uiText("CPC (custo/clique)")}</p>
          </div>
        </div>
      </Card>

      {/* CTR Benchmark */}
      <Card className="p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />{uiText("Benchmark de CTR")}</h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{uiText("Seu CTR")}</span>
              <span className="font-medium">{ctr}%</span>
            </div>
            <Progress value={parseFloat(ctr) * 10} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground">{uiText("CTR médio na plataforma: 2-5%. {{value1}}", { value1: (parseFloat(ctr) >= 2 ? uiText("✨ Seu desempenho está excelente!") : uiText("Continue otimizando seus anúncios.")) ?? "" })}</p>
        </div>
      </Card>

      {/* Top Performing Ads by Clicks */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <MousePointer className="w-4 h-4" />{uiText("Anúncios com Mais Cliques")}</h4>
        <div className="space-y-2">
          {adsByClicks.slice(0, 5).map((ad, index) => (
            <Card
              key={ad.id}
              className="p-3 cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.98]"
              onClick={() => onAdClick?.(ad)}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ad.title || uiText("Sem título")}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{uiText("CTR: {{value1}}%", { value1: (ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0') ?? "" })}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{ad.clicks.toLocaleString(uiLocale())}</p>
                  <p className="text-xs text-muted-foreground">{uiText("cliques")}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Tips */}
      <Card className="p-4 bg-secondary/50">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium mb-1">{uiText("Dica para aumentar cliques")}</p>
            <p className="text-xs text-muted-foreground">{uiText("Use chamadas à ação claras e imagens atrativas. Teste diferentes textos para ver o que funciona melhor.")}</p>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (statType) {
      case 'credits': return renderCreditsContent();
      case 'ads': return renderAdsContent();
      case 'impressions': return renderImpressionsContent();
      case 'clicks': return renderClicksContent();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(85vh-80px)] pr-4">
          {renderContent()}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
