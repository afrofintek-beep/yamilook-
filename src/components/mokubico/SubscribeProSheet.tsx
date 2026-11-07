import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Loader2, Video, Mic, Check, Smartphone, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onActivated?: () => void;
}

type Period = 'monthly' | 'annual';
type Method = 'GPO' | 'REF';
type Phase = 'choose' | 'pending' | 'ref' | 'done';

const fmtKz = (n: number) => `${n.toLocaleString(uiLocale())} Kz`;

/** Subscribe to Mokubico Pro via AppyPay. Price comes from billing_config;
 *  payment is confirmed by polling check-pro-subscription (webhook unreliable). */
export function SubscribeProSheet({ open, onOpenChange, onActivated }: Props) {
  useUiLocale();
  const { refreshProfile } = useAuth();
  const [cfg, setCfg] = useState<{ pro_monthly: number; pro_annual: number } | null>(null);
  const [period, setPeriod] = useState<Period>('monthly');
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
    supabase.from('billing_config').select('pro_monthly, pro_annual').eq('id', 1).maybeSingle()
      .then(({ data }) => setCfg(data as { pro_monthly: number; pro_annual: number } | null));
  }, [open]);

  const stopPoll = () => { if (poll.current) { clearInterval(poll.current); poll.current = null; } };
  useEffect(() => () => stopPoll(), []);

  const amount = cfg ? (period === 'annual' ? cfg.pro_annual : cfg.pro_monthly) : 0;
  const monthlyEquiv = cfg && cfg.pro_annual ? Math.round(cfg.pro_annual / 12) : 0;

  const activated = async () => {
    stopPoll();
    setPhase('done');
    await refreshProfile();
    onActivated?.();
    toast.success(uiText("Já és Pro! Voz e vídeo desbloqueados. 👑"));
  };

  const check = async () => {
    const { data } = await supabase.functions.invoke('check-pro-subscription', {
      body: { purchaseId: purchaseId.current },
    });
    if ((data as { activated?: number })?.activated && (data as { activated: number }).activated > 0) {
      await activated();
    }
  };

  const startPolling = () => {
    stopPoll();
    poll.current = setInterval(check, 10000);
  };

  const pay = async () => {
    if (method === 'GPO' && phone.replace(/\D/g, '').length < 9) {
      toast.info(uiText("Escreve o teu número Multicaixa Express."));
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-pro-subscription', {
        body: { period, method, phone },
      });
      if (error) throw error;
      const r = data as { status: string; purchaseId?: string; entity?: string | null; reference?: string | null; message?: string; error?: string };
      if (r.error) { toast.error(r.error); return; }
      purchaseId.current = r.purchaseId ?? null;

      if (r.status === 'paid') { await activated(); return; }
      if (r.status === 'pending_ref') {
        setRef({ entity: r.entity ?? null, reference: r.reference ?? null });
        setPhase('ref'); startPolling(); return;
      }
      if (r.status === 'pending_push') { setPhase('pending'); startPolling(); return; }
      if (r.status === 'gateway_pending') {
        toast.info(uiText("Subscrição registada — o pagamento ainda não está ativo (falta configurar o gateway)."));
        setPhase('pending'); return;
      }
      toast.info(r.message ?? 'A processar…');
      setPhase('pending'); startPolling();
    } catch {
      toast.error(uiText("Não foi possível iniciar o pagamento."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) stopPoll(); onOpenChange(o); }}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />{uiText(" Mokubico Pro")}</SheetTitle>
        </SheetHeader>

        {phase === 'done' ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="font-semibold">{uiText("Já és Pro! 👑")}</p>
            <p className="text-sm text-muted-foreground">{uiText("Voz e vídeo em grupo desbloqueados no Quintal.")}</p>
            <Button className="w-full h-12 rounded-xl mt-2" onClick={() => onOpenChange(false)}>{uiText("Boa!")}</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Value */}
            <div className="rounded-2xl bg-secondary/50 p-4 space-y-2">
              <p className="text-sm font-medium">{uiText("Desbloqueia no Quintal:")}</p>
              <div className="flex items-center gap-2 text-sm"><Mic className="w-4 h-4 text-primary" />{uiText(" Voz em grupo")}</div>
              <div className="flex items-center gap-2 text-sm"><Video className="w-4 h-4 text-primary" />{uiText(" Vídeo em grupo")}</div>
            </div>

            {/* Plan */}
            {cfg && (
              <div className="grid grid-cols-2 gap-3">
                {(['monthly', 'annual'] as Period[]).map((p) => (
                  <button key={p} type="button" onClick={() => setPeriod(p)}
                    className={cn('rounded-2xl border p-4 text-left transition-colors',
                      period === p ? 'border-primary bg-primary/5' : 'border-border')}>
                    <div className="text-xs text-muted-foreground">{p === 'annual' ? uiText("Anual") : uiText("Mensal")}</div>
                    <div className="text-lg font-bold">{fmtKz(p === 'annual' ? cfg.pro_annual : cfg.pro_monthly)}</div>
                    {p === 'annual' && monthlyEquiv > 0 && (
                      <div className="text-[11px] text-emerald-600">≈ {fmtKz(monthlyEquiv)}/mês</div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Method */}
            <div className="space-y-2">
              <Label className="text-sm">{uiText("Como pagas")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setMethod('GPO')}
                  className={cn('rounded-xl border p-3 flex items-center gap-2 text-sm transition-colors',
                    method === 'GPO' ? 'border-primary bg-primary/5' : 'border-border')}>
                  <Smartphone className="w-4 h-4" />{uiText(" Multicaixa Express")}</button>
                <button type="button" onClick={() => setMethod('REF')}
                  className={cn('rounded-xl border p-3 flex items-center gap-2 text-sm transition-colors',
                    method === 'REF' ? 'border-primary bg-primary/5' : 'border-border')}>
                  <Receipt className="w-4 h-4" />{uiText(" Referência")}</button>
              </div>
            </div>

            {method === 'GPO' && phase === 'choose' && (
              <div className="space-y-1.5">
                <Label className="text-sm">{uiText("Número Multicaixa Express")}</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
                  placeholder={uiText("9xx xxx xxx")} className="h-11" />
              </div>
            )}

            {phase === 'ref' && ref && (
              <div className="rounded-xl bg-secondary/50 p-4 space-y-1 text-sm">
                <p className="font-medium">{uiText("Paga esta referência:")}</p>
                <div className="flex justify-between"><span className="text-muted-foreground">{uiText("Entidade")}</span><span className="font-mono font-semibold">{ref.entity ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{uiText("Referência")}</span><span className="font-mono font-semibold">{ref.reference ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{uiText("Valor")}</span><span className="font-semibold">{fmtKz(amount)}</span></div>
              </div>
            )}

            {phase === 'pending' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/40 rounded-xl p-3">
                <Loader2 className="w-4 h-4 animate-spin" />{uiText(" À espera da confirmação do pagamento…")}</div>
            )}

            {phase === 'choose' ? (
              <Button className="w-full h-12 rounded-xl" onClick={pay} disabled={busy || !cfg}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `Pagar ${fmtKz(amount)}`}
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
