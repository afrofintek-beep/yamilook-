import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Coins, Loader2, Check, Smartphone, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPurchased?: () => void;
}

const PACKAGES = [
  { id: 'p100', kumbu: 100, kwanza: 1000 },
  { id: 'p500', kumbu: 500, kwanza: 4500 },
  { id: 'p1200', kumbu: 1200, kwanza: 10000 },
];
type Method = 'GPO' | 'REF';
type Phase = 'choose' | 'pending' | 'ref' | 'done';
const fmtKz = (n: number) => `${n.toLocaleString(uiLocale())} Kz`;

/** Buy Kumbu via AppyPay. Purchased Kumbu is spend-only (não levantável).
 *  Payment confirmed by polling check-kumbu-topup (webhook unreliable). */
export function BuyKumbuSheet({ open, onOpenChange, onPurchased }: Props) {
  useUiLocale();
  const { refreshProfile } = useAuth();
  const [packageId, setPackageId] = useState('p500');
  const [method, setMethod] = useState<Method>('GPO');
  const [phone, setPhone] = useState('');
  const [phase, setPhase] = useState<Phase>('choose');
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<{ entity: string | null; reference: string | null } | null>(null);
  const purchaseId = useRef<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase('choose'); setRef(null); purchaseId.current = null;
  }, [open]);
  const stopPoll = () => { if (poll.current) { clearInterval(poll.current); poll.current = null; } };
  useEffect(() => () => stopPoll(), []);

  const pkg = PACKAGES.find((p) => p.id === packageId)!;

  const done = async () => {
    stopPoll(); setPhase('done');
    await refreshProfile(); onPurchased?.();
    toast.success(uiText("Kumbu adicionado! 🎉"));
  };
  const check = async () => {
    const { data } = await supabase.functions.invoke('check-kumbu-topup', { body: { purchaseId: purchaseId.current } });
    if ((data as { credited?: number })?.credited && (data as { credited: number }).credited > 0) await done();
  };
  const startPolling = () => { stopPoll(); poll.current = setInterval(check, 10000); };

  const pay = async () => {
    if (method === 'GPO' && phone.replace(/\D/g, '').length < 9) { toast.info(uiText("Escreve o teu número Multicaixa Express.")); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-kumbu-topup', { body: { packageId, method, phone } });
      if (error) throw error;
      const r = data as { status: string; purchaseId?: string; entity?: string | null; reference?: string | null; message?: string; error?: string };
      if (r.error) { toast.error(r.error); return; }
      purchaseId.current = r.purchaseId ?? null;
      if (r.status === 'paid') { await done(); return; }
      if (r.status === 'pending_ref') { setRef({ entity: r.entity ?? null, reference: r.reference ?? null }); setPhase('ref'); startPolling(); return; }
      if (r.status === 'pending_push') { setPhase('pending'); startPolling(); return; }
      if (r.status === 'gateway_pending') { toast.info(uiText("Compra registada — pagamento ainda não ativo (falta configurar o gateway).")); setPhase('pending'); return; }
      setPhase('pending'); startPolling();
    } catch {
      toast.error(uiText("Não foi possível iniciar o pagamento."));
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) stopPoll(); onOpenChange(o); }}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2"><Coins className="w-5 h-5 text-amber-500" />{uiText(" Comprar Kumbu")}</SheetTitle>
        </SheetHeader>

        {phase === 'done' ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="font-semibold">{uiText("Kumbu adicionado! 🎉")}</p>
            <Button className="w-full h-12 rounded-xl mt-2" onClick={() => onOpenChange(false)}>{uiText("Boa!")}</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              {PACKAGES.map((p) => (
                <button key={p.id} type="button" onClick={() => setPackageId(p.id)}
                  className={cn('rounded-2xl border p-3 text-center transition-colors',
                    packageId === p.id ? 'border-amber-500 bg-amber-500/5' : 'border-border')}>
                  <div className="text-lg font-bold flex items-center justify-center gap-1"><Coins className="w-4 h-4 text-amber-500" />{p.kumbu}</div>
                  <div className="text-xs text-muted-foreground">{fmtKz(p.kwanza)}</div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-sm">{uiText("Como pagas")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setMethod('GPO')}
                  className={cn('rounded-xl border p-3 flex items-center gap-2 text-sm transition-colors', method === 'GPO' ? 'border-primary bg-primary/5' : 'border-border')}>
                  <Smartphone className="w-4 h-4" />{uiText(" Multicaixa Express")}</button>
                <button type="button" onClick={() => setMethod('REF')}
                  className={cn('rounded-xl border p-3 flex items-center gap-2 text-sm transition-colors', method === 'REF' ? 'border-primary bg-primary/5' : 'border-border')}>
                  <Receipt className="w-4 h-4" />{uiText(" Referência")}</button>
              </div>
            </div>

            {method === 'GPO' && phase === 'choose' && (
              <div className="space-y-1.5">
                <Label className="text-sm">{uiText("Número Multicaixa Express")}</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder={uiText("9xx xxx xxx")} className="h-11" />
              </div>
            )}

            {phase === 'ref' && ref && (
              <div className="rounded-xl bg-secondary/50 p-4 space-y-1 text-sm">
                <p className="font-medium">{uiText("Paga esta referência:")}</p>
                <div className="flex justify-between"><span className="text-muted-foreground">{uiText("Entidade")}</span><span className="font-mono font-semibold">{ref.entity ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{uiText("Referência")}</span><span className="font-mono font-semibold">{ref.reference ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{uiText("Valor")}</span><span className="font-semibold">{fmtKz(pkg.kwanza)}</span></div>
              </div>
            )}
            {phase === 'pending' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/40 rounded-xl p-3">
                <Loader2 className="w-4 h-4 animate-spin" />{uiText(" À espera da confirmação do pagamento…")}</div>
            )}

            <p className="text-[11px] text-muted-foreground">{uiText("O Kumbu comprado serve para gastar na app (não é levantável).")}</p>

            {phase === 'choose' ? (
              <Button className="w-full h-12 rounded-xl" onClick={pay} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `Pagar ${fmtKz(pkg.kwanza)}`}
              </Button>
            ) : (
              <Button variant="secondary" className="w-full h-12 rounded-xl" onClick={check}>{uiText("Já paguei — verificar agora")}</Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
