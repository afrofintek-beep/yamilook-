import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { Coins, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CurrencySelector } from './CurrencySelector';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

interface CreditDisplayProps {
  credits: number;
  showSelector?: boolean;
  showEquivalent?: boolean;
  showRefresh?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'card';
}

export function CreditDisplay({
  credits,
  showSelector = true,
  showEquivalent = true,
  showRefresh = false,
  size = 'md',
  variant = 'default'
}: CreditDisplayProps) {
  useUiLocale();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    currencies,
    selectedCurrency,
    referenceCurrencies,
    localCurrencies,
    loading,
    changeCurrency,
    formatMoney,
    updateRates,
    getLastUpdate
  } = useCurrencyRates();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await updateRates();
    setIsRefreshing(false);
  };

  const lastUpdate = getLastUpdate();

  const sizeClasses = {
    sm: { credits: 'text-lg', equivalent: 'text-xs' },
    md: { credits: 'text-2xl', equivalent: 'text-sm' },
    lg: { credits: 'text-4xl', equivalent: 'text-base' }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  const content = (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Coins className={`text-primary ${size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'}`} />
        <span className={`font-bold text-primary ${sizeClasses[size].credits}`}>
          {credits.toLocaleString()}
        </span>
        <span className={`text-muted-foreground ${sizeClasses[size].equivalent}`}>{uiText("créditos")}</span>
      </div>

      {showEquivalent && selectedCurrency && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-muted-foreground ${sizeClasses[size].equivalent}`}>
            ≈ {formatMoney(credits)}
          </span>

          {showSelector && (
            <CurrencySelector
              currencies={currencies}
              selectedCurrency={selectedCurrency}
              referenceCurrencies={referenceCurrencies}
              localCurrencies={localCurrencies}
              onCurrencyChange={changeCurrency}
              compact
            />
          )}

          {showRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-6 px-2"
              title={lastUpdate ? `Última atualização: ${formatDistanceToNow(lastUpdate, { addSuffix: true, locale: pt })}` : uiText("Atualizar taxas")}
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (variant === 'card') {
    return (
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
        {content}
      </Card>
    );
  }

  return content;
}
