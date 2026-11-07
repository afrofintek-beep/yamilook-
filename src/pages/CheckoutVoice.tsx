import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Building2, Smartphone, CheckCircle, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { usePalco, useVozes, useConfirmVozPayment } from '@/hooks/usePalco';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';

const paymentMethods = [
  { id: 'multicaixa', get label() { return uiText("Multicaixa Express"); }, icon: Smartphone, popular: true },
  { id: 'transfer', get label() { return uiText("Transferência Bancária"); }, icon: Building2, popular: false },
  { id: 'card', get label() { return uiText("Cartão de Crédito/Débito"); }, icon: CreditCard, popular: false },
  { id: 'mobile', get label() { return uiText("Mobile Money"); }, icon: Smartphone, popular: false },
];

const VOICE_TYPE_LABELS: Record<string, string> = { email: 'Email', live: 'Live', highlight: 'Destaque' };

export default function CheckoutVoice() {
  useUiLocale();
  const { palcoId, rodaId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const vozId = searchParams.get('vozId');
  const customText = searchParams.get('customText') || '';

  const [selectedMethod, setSelectedMethod] = useState('multicaixa');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: palco } = usePalco(palcoId);
  const { data: vozes, isLoading: vozesLoading } = useVozes(rodaId);
  const { selectedCurrency } = useCurrencyRates();
  const confirmPayment = useConfirmVozPayment();

  const voz = vozes?.find((v) => v.id === vozId);
  const priceInfo = palco?.voice_types?.find((vt) => vt.voice_type === voz?.voice_type);
  const question = voz?.custom_text || customText;
  const typeLabel = voz ? (VOICE_TYPE_LABELS[voz.voice_type] ?? voz.voice_type) : '';

  // Calculate local amount from the real voice-type price
  const baseAmountUSD = priceInfo?.price ?? 0;
  const fxRate = selectedCurrency?.rate_to_usd || 1;
  const localAmount = baseAmountUSD / fxRate;
  const formattedLocalAmount = selectedCurrency
    ? `${selectedCurrency.symbol}${localAmount.toFixed(2)}`
    : `$${baseAmountUSD}`;

  const handleConfirmPayment = async () => {
    if (!voz || !vozId || !rodaId) return;
    setIsProcessing(true);
    try {
      await confirmPayment.mutateAsync({
        vozId,
        rodaId,
        amountPaid: baseAmountUSD,
        currency: priceInfo?.currency ?? selectedCurrency?.currency_code,
        paymentMethod: selectedMethod,
      });
      navigate(`/palco/${palcoId}/roda/${rodaId}/success?type=voice`);
    } catch {
      // error toast handled by the mutation's onError
    } finally {
      setIsProcessing(false);
    }
  };

  if (vozesLoading) {
    return (
      <div className="min-h-screen bg-palco-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-palco-accent" />
      </div>
    );
  }

  if (!voz) {
    return (
      <div className="min-h-screen bg-palco-bg flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-palco-text">{uiText("Voz não encontrada.")}</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-palco-accent">{uiText("Voltar")}</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-palco-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-palco-surface border-b border-palco-border px-4 py-3 safe-top">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-palco-text"
            disabled={isProcessing}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-palco-text">{uiText("Pagamento")}</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Order Summary */}
        <Card className="border-palco-border bg-palco-surface">
          <CardContent className="p-4">
            <h2 className="text-base font-semibold text-palco-text mb-4">{uiText("Resumo do pedido")}</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-palco-text-secondary">{uiText("Voz")}</span>
                <span className="text-sm font-medium text-palco-text line-clamp-1 max-w-[200px] text-right">
                  {question.substring(0, 40)}{question.length > 40 ? '…' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-palco-text-secondary">{uiText("Tipo")}</span>
                <span className="text-sm font-medium text-palco-text">{typeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-palco-text-secondary">{uiText("Preço (USD)")}</span>
                <span className="text-sm font-medium text-palco-text">${baseAmountUSD}</span>
              </div>
              {selectedCurrency && selectedCurrency.currency_code !== 'USD' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-palco-text-secondary">{uiText("Câmbio")}</span>
                  <span className="text-sm text-palco-text-secondary">{uiText("1 USD = ")}{(1/fxRate).toFixed(2)} {selectedCurrency.currency_code}
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-palco-border">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-palco-text">{uiText("Total")}</span>
                  <span className="text-xl font-bold text-palco-accent">
                    {formattedLocalAmount}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quote Hint */}
        <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 rounded-lg">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">{uiText("O valor é fixado por alguns minutos para concluir o pagamento.")}</p>
        </div>

        {/* Payment Methods */}
        <Card className="border-palco-border bg-palco-surface">
          <CardContent className="p-4">
            <h2 className="text-base font-semibold text-palco-text mb-4">{uiText("Método de pagamento")}</h2>

            <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
              <div className="space-y-3">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <label
                      key={method.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                        selectedMethod === method.id
                          ? "border-palco-accent bg-palco-accent/5"
                          : "border-palco-border hover:border-palco-accent/50"
                      )}
                    >
                      <RadioGroupItem value={method.id} id={method.id} className="sr-only" />
                      <div className={cn(
                        "p-2 rounded-lg",
                        selectedMethod === method.id
                          ? "bg-palco-accent text-white"
                          : "bg-palco-bg text-palco-text-secondary"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-palco-text">
                            {method.label}
                          </span>
                          {method.popular && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-palco-accent/10 text-palco-accent rounded-full font-medium">{uiText("Popular")}</span>
                          )}
                        </div>
                      </div>
                      {selectedMethod === method.id && (
                        <CheckCircle className="w-5 h-5 text-palco-accent" />
                      )}
                    </label>
                  );
                })}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-palco-surface border-t border-palco-border p-4">
        <Button
          onClick={handleConfirmPayment}
          disabled={isProcessing}
          className="w-full bg-palco-accent hover:bg-palco-accent/90 text-white rounded-full h-12 text-base font-medium"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />{uiText("A processar...")}</>
          ) : (
            `Confirmar pagamento - ${formattedLocalAmount}`
          )}
        </Button>
      </div>
    </div>
  );
}
