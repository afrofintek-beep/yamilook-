import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { Globe, DollarSign, ChevronDown } from 'lucide-react';
import { CurrencyRate } from '@/hooks/useCurrencyRates';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface CurrencySelectorProps {
  currencies: CurrencyRate[];
  selectedCurrency: CurrencyRate | null;
  referenceCurrencies: CurrencyRate[];
  localCurrencies: CurrencyRate[];
  onCurrencyChange: (currencyCode: string) => void;
  compact?: boolean;
}

// Country code to flag emoji mapping
function getCountryFlag(countryCode: string): string {
  if (countryCode === 'EU') return '🇪🇺';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function CurrencySelector({
  currencies,
  selectedCurrency,
  referenceCurrencies,
  localCurrencies,
  onCurrencyChange,
  compact = false
}: CurrencySelectorProps) {
  useUiLocale();
  if (!selectedCurrency) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={compact ? "h-8 px-2 text-xs gap-1" : "h-10 px-3 gap-2"}
        >
          <span className="text-base">{getCountryFlag(selectedCurrency.country_code)}</span>
          <span className={compact ? "text-xs font-medium" : "text-sm font-medium"}>
            {selectedCurrency.currency_code}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[220px] max-h-[300px] overflow-y-auto"
        align="start"
      >
        {referenceCurrencies.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DollarSign className="w-3 h-3" />{uiText("Moedas de Referência")}</DropdownMenuLabel>
            {referenceCurrencies.map((currency) => (
              <DropdownMenuItem
                key={currency.id}
                onClick={() => onCurrencyChange(currency.currency_code)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="text-base">{getCountryFlag(currency.country_code)}</span>
                  <span className="font-medium">{currency.currency_code}</span>
                  <span className="text-muted-foreground text-xs">
                    {currency.currency_name}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}

        {localCurrencies.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
              <Globe className="w-3 h-3" />{uiText("Moedas Locais")}</DropdownMenuLabel>
            {localCurrencies.map((currency) => (
              <DropdownMenuItem
                key={currency.id}
                onClick={() => onCurrencyChange(currency.currency_code)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="text-base">{getCountryFlag(currency.country_code)}</span>
                  <span className="font-medium">{currency.currency_code}</span>
                  <span className="text-muted-foreground text-xs truncate max-w-[100px]">
                    {currency.country_name}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
