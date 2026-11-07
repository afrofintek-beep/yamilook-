import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Banknote } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AfrolocCertificationGate } from '../components/AfrolocCertificationGate';
import { useAfrolocCertification } from '../hooks/useAfrolocCertification';

// Minimum Kumbu per payout request (must match the request_payout server RPC).
const MIN_PAYOUT_KUMBU = 1000;

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  pending: { get label() { return uiText("Pendente"); }, variant: 'secondary' },
  approved: { get label() { return uiText("Aprovado"); }, variant: 'default' },
  processed: { get label() { return uiText("Processado"); }, variant: 'default' },
  rejected: { get label() { return uiText("Rejeitado"); }, variant: 'destructive' },
};

export default function Payouts() {
  useUiLocale();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isCertified } = useAfrolocCertification();
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [payouts, setPayouts] = useState<Tables<'payout_requests'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState<number>(profile?.kumbu_available ?? 0);
  const [aoaFactor, setAoaFactor] = useState<number | null>(null); // AOA per 1 Kumbu

  const kumbuAvailable = balance;
  const fmtKz = (n: number) => new Intl.NumberFormat(uiLocale()).format(Math.round(n)) + ' Kz';

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Check eligibility: approved creator application
      const { data: app } = await supabase
        .from('creator_applications')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();

      setEligible(!!app);

      // Fresh balance (the deduction on request makes the useAuth profile stale).
      const { data: prof } = await supabase
        .from('profiles').select('kumbu_available').eq('id', user.id).maybeSingle();
      if (prof) setBalance(prof.kumbu_available ?? 0);

      // Kumbu -> AOA factor from currency_rates (same anchor as the server RPC).
      const { data: rate } = await supabase
        .from('currency_rates')
        .select('credits_per_usd, rate_to_usd')
        .eq('currency_code', 'AOA').eq('is_active', true).maybeSingle();
      if (rate && Number(rate.credits_per_usd) && Number(rate.rate_to_usd)) {
        setAoaFactor((1 / Number(rate.credits_per_usd)) / Number(rate.rate_to_usd));
      }

      // Fetch payouts history
      const { data: pData } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setPayouts(pData ?? []);
      setLoading(false);
    })();
  }, [user]);

  const handleSubmit = async () => {
    const kumbu = parseInt(amount, 10);
    if (!user || isNaN(kumbu) || kumbu <= 0) return;
    if (kumbu > kumbuAvailable) {
      toast.error(uiText("Saldo insuficiente."));
      return;
    }

    setSubmitting(true);
    // Server-side RPC: deducts Kumbu atomically and stores the AOA value.
    const { data, error } = await supabase.rpc('request_payout' as never, { p_amount_kumbu: kumbu } as never);
    setSubmitting(false);
    if (error) {
      toast.error(error.message || 'Erro ao submeter pedido.');
      return;
    }

    const res = data as { amount_local?: number } | null;
    toast.success(
      res?.amount_local != null ? `Pedido submetido — ${fmtKz(res.amount_local)}.` : 'Pedido de payout submetido.',
    );
    setShowModal(false);
    setAmount('');
    setBalance((b) => b - kumbu); // reflect the debit immediately

    // Refresh list
    const { data: list } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setPayouts(list ?? []);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{uiText("A carregar…")}</p>
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3 safe-top">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{uiText("Payouts")}</h1>
        </header>
        <main className="max-w-lg mx-auto px-4 pt-8 text-center space-y-3">
          <Banknote className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{uiText("A funcionalidade de payouts está disponível apenas para criadores e mentores verificados.")}</p>
          <Button variant="secondary" onClick={() => navigate('/creator/apply')}>{uiText("Candidatar-me como criador")}</Button>
        </main>
      </div>
    );
  }

  if (!isCertified) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3 safe-top">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{uiText("Payouts")}</h1>
        </header>
        <main className="max-w-lg mx-auto px-4 pt-4">
          <AfrolocCertificationGate action="pedir payout">
            <span />
          </AfrolocCertificationGate>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3 safe-top">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">{uiText("Payouts")}</h1>
        <Button size="sm" onClick={() => setShowModal(true)}>{uiText("Novo pedido")}</Button>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{uiText("Kumbu disponível")}</p>
              <p className="text-2xl font-semibold">{kumbuAvailable}</p>
              {aoaFactor && kumbuAvailable > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">≈ {fmtKz(kumbuAvailable * aoaFactor)}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground max-w-[160px] text-right leading-relaxed">{uiText("Mínimo 1000 Kumbu · sujeito a verificação.")}</p>
          </CardContent>
        </Card>

        {/* History */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-base">{uiText("Histórico")}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {payouts.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">{uiText("Sem pedidos registados.")}</p>
            )}
            <ul className="divide-y">
              {payouts.map((p) => {
                const st = STATUS_MAP[p.status] ?? STATUS_MAP.pending;
                return (
                  <li key={p.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.amount_kumbu} Kumbu</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(p.created_at), "d MMM yyyy", { locale: pt })}
                      </p>
                    </div>
                    <Badge variant={st.variant} className="text-xs shrink-0">
                      {st.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </main>

      {/* Request Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base">{uiText("Novo pedido de payout")}</DialogTitle>
            <DialogDescription className="text-xs">{uiText("Conversão mensal — sujeito a verificação.")}</DialogDescription>
          </DialogHeader>

          {kumbuAvailable < MIN_PAYOUT_KUMBU ? (
            // Below the minimum: no valid amount exists, so explain instead of
            // showing a permanently-disabled button with contradictory labels.
            <div className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground my-2">{uiText("Precisas de pelo menos ")}<span className="font-semibold text-foreground">{MIN_PAYOUT_KUMBU} Kumbu</span>{uiText(" para pedir um payout. Tens ")}<span className="font-semibold text-foreground">{kumbuAvailable}</span>{uiText(" — faltam ")}<span className="font-semibold text-foreground">{MIN_PAYOUT_KUMBU - kumbuAvailable}</span>.
            </div>
          ) : (
            <>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-sm">{uiText("Quantidade (Kumbu)")}</Label>
                  <Input
                    id="amount"
                    type="number"
                    min={MIN_PAYOUT_KUMBU}
                    max={kumbuAvailable}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Entre ${MIN_PAYOUT_KUMBU} e ${kumbuAvailable}`}
                  />
                  <p className="text-xs text-muted-foreground">{uiText("Mínimo ")}{MIN_PAYOUT_KUMBU}{uiText(" Kumbu · máximo ")}{kumbuAvailable}.
                  </p>
                  {aoaFactor && parseInt(amount) > 0 && (
                    <p className="text-xs text-muted-foreground">{uiText("Vais receber ≈ ")}{fmtKz(parseInt(amount) * aoaFactor)}</p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  className="w-full"
                  disabled={!amount || parseInt(amount) < MIN_PAYOUT_KUMBU || parseInt(amount) > kumbuAvailable || submitting}
                  onClick={handleSubmit}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}{uiText("Solicitar payout")}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
