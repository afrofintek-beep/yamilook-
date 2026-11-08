import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Coins, Loader2, Check, Smartphone, Receipt } from 'lucide-react';

// Keep in sync with the PACKAGES map in the create-appypay-payment edge function.
const PACKAGES = [
  { id: 'start', credits: 1000, kwanza: 9000, get label() { return uiText("Início"); } },
  { id: 'pro', credits: 5000, kwanza: 42000, get label() { return uiText("Pro"); }, popular: true },
  { id: 'max', credits: 12000, kwanza: 96000, get label() { return uiText("Máximo"); } },
];

const kz = (n: number) => new Intl.NumberFormat(uiLocale()).format(n) + ' Kz';

interface RefResult {
  method: 'REF';
  purchaseId?: string;
  entity?: string | null;
  reference?: string | null;
  amountKwanza?: number;
  credits?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
}

export function BuyCreditsSheet({ open, onOpenChange, onDone }: Props) {
  useUiLocale();
  const [sel, setSel] = useState('pro');
  const [method, setMethod] = useState<'GPO' | 'REF'>('GPO');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [refResult, setRefResult] = useState<RefResult | null>(null);

  const reset = () => { setRefResult(null); setPhone(''); setChecking(false); };

  // Query the charge status and credit if it's been paid. AppyPay's webhook isn't
  // reliably delivered, so this is how a REF (paid at ATM) actually confirms.
  const verifyPayment = async (silent = false): Promise<boolean> => {
    if (!silent) setChecking(true);
    const { data } = await supabase.functions.invoke('check-appypay-payment', {
      body: refResult?.purchaseId ? { purchaseId: refResult.purchaseId } : {},
    });
    if (!silent) setChecking(false);
    if ((data as { credited?: number })?.credited) {
      toast.success(uiText("Pagamento confirmado! Créditos adicionados. ✅"));
      onDone?.();
      close(false);
      return true;
    }
    if (!silent) toast.info(uiText("Ainda não recebemos a confirmação do pagamento. Tenta novamente daqui a pouco."));
    return false;
  };

  // While the reference is on-screen, poll the status so credits land on their own.
  useEffect(() => {
    if (!refResult) return;
    const id = setInterval(() => { verifyPayment(true); }, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refResult]);

  const buy = async () => {
    const digits = phone.replace(/\D/g, '');
    if (method === 'GPO' && digits.length < 9) {
      toast.error(uiText("Indica o número de telemóvel do Multicaixa Express."));
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('create-appypay-payment', {
      body: { packageId: sel, method, phone: method === 'GPO' ? digits : undefined },
    });
    setLoading(false);

    // The edge function returns { error } with a non-2xx status on failure.
    const errMsg = (data && (data as { error?: string }).error) || (error ? 'Falha ao iniciar o pagamento.' : null);
    if (errMsg) {
      toast.error(errMsg);
      return;
    }

    const status = (data as { status?: string })?.status;
    if (status === 'gateway_pending') {
      toast.info(uiText("Compra registada. O pagamento AppyPay ainda está a ser ativado."));
      onDone?.();
      onOpenChange(false);
      return;
    }

    if (status === 'paid') {
      toast.success(uiText("Pagamento confirmado! Créditos adicionados. ✅"));
      onDone?.();
      onOpenChange(false);
      return;
    }

    if (method === 'REF') {
      // Show the reference on-screen — the buyer needs to write it down and pay later.
      const r = data as { entity?: string; reference?: string; purchaseId?: string };
      setRefResult({ method: 'REF', purchaseId: r.purchaseId, entity: r.entity, reference: r.reference, amountKwanza: pkgFor(sel).kwanza, credits: pkgFor(sel).credits });
      onDone?.();
      return;
    }

    // GPO — a push was sent to the phone.
    toast.success(uiText("Confirma o pagamento no teu telemóvel (Multicaixa Express)."));
    onDone?.();
    onOpenChange(false);
  };

  const pkgFor = (id: string) => PACKAGES.find((p) => p.id === id) ?? PACKAGES[1];

  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-y-auto">
        <SheetHeader className="p-5 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />{uiText(" Comprar créditos")}</SheetTitle>
        </SheetHeader>

        {refResult ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Receipt className="w-5 h-5" />
              <span className="font-semibold">{uiText("Referência gerada")}</span>
            </div>
            <p className="text-sm text-muted-foreground">{uiText("Paga esta referência no Multicaixa Express, ATM ou Internet Banking. Os créditos entram automaticamente após o pagamento.")}</p>
            <div className="rounded-xl border border-border divide-y divide-border">
              <div className="flex items-center justify-between p-3">
                <span className="text-xs text-muted-foreground">{uiText("Entidade")}</span>
                <span className="font-bold tabular-nums">{refResult.entity ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-xs text-muted-foreground">{uiText("Referência")}</span>
                <span className="font-bold tabular-nums">{refResult.reference ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-xs text-muted-foreground">{uiText("Montante")}</span>
                <span className="font-bold tabular-nums">{kz(refResult.amountKwanza ?? 0)}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">{uiText("A verificar o pagamento automaticamente… assim que pagares, os créditos entram sozinhos.")}</p>
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl"
              onClick={() => verifyPayment(false)}
              disabled={checking}
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : uiText("Já paguei — verificar agora")}
            </Button>
            <Button className="w-full h-12 rounded-xl" onClick={() => close(false)}>{uiText("Concluído")}</Button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <p className="text-sm text-muted-foreground">{uiText("Os créditos servem para promover os teus posts e o teu negócio no feed. Escolhe um pacote.")}</p>

            <div className="space-y-2">
              {PACKAGES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSel(p.id)}
                  className={`w-full text-left rounded-xl border p-4 transition ${
                    sel === p.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2">{uiText("{{value1}} créditos", { value1: (p.credits.toLocaleString(uiLocale())) ?? "" })}{p.popular && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">{uiText("POPULAR")}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.label}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold tabular-nums">{kz(p.kwanza)}</div>
                      {sel === p.id && <Check className="w-4 h-4 text-primary ml-auto mt-1" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">{uiText("Método de pagamento")}</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('GPO')}
                  className={`rounded-lg border p-3 text-sm font-medium ${
                    method === 'GPO' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >{uiText("Multicaixa Express")}</button>
                <button
                  type="button"
                  onClick={() => setMethod('REF')}
                  className={`rounded-lg border p-3 text-sm font-medium ${
                    method === 'REF' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >{uiText("Referência")}</button>
              </div>
            </div>

            {method === 'GPO' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />{uiText(" Telemóvel Multicaixa Express")}</label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder={uiText("9XX XXX XXX")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">{uiText("Vais receber um pedido de confirmação neste número.")}</p>
              </div>
            )}

            <Button className="w-full h-12 rounded-xl" onClick={buy} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : uiText("Pagar com AppyPay")}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">{uiText("Pagamento seguro via AppyPay · valores em AOA")}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
