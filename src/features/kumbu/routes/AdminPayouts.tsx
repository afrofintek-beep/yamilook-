import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { uiServerMessage } from '@/i18n/server-copy';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from '@/i18n/ui-date';

type PayoutFilter = 'all' | 'pending' | 'approved' | 'processed' | 'rejected';

const BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  processed: 'default',
  rejected: 'destructive',
};

const payoutStatus: Record<string, string> = {
  get pending() { return uiText('Pendente'); },
  get approved() { return uiText('Aprovado'); },
  get processed() { return uiText('Pago'); },
  get rejected() { return uiText('Rejeitado'); },
};

export default function AdminPayouts() {
  useUiLocale();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<PayoutFilter>('pending');
  const [payouts, setPayouts] = useState<Tables<'payout_requests'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchPayouts = useCallback(async () => {
    let q = supabase
      .from('payout_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setPayouts(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { setLoading(true); fetchPayouts(); }, [fetchPayouts]);

  const fmtKz = (n: number) => new Intl.NumberFormat(uiLocale()).format(Math.round(n)) + ' Kz';

  // Server-side RPC: approve / mark paid / reject (reject refunds the creator's Kumbu).
  const runAction = async (id: string, action: 'approve' | 'process' | 'reject', reason?: string) => {
    setActing(id);
    const { error } = await supabase.rpc('process_payout' as never, {
      p_payout_id: id, p_action: action, p_reason: reason ?? null,
    } as never);
    if (error) toast.error(uiServerMessage(error.message, uiText('Não foi possível atualizar o pagamento.')));
    else {
      toast.success(action === 'reject' ? uiText("Rejeitado — Kumbu devolvido.") : action === 'process' ? uiText("Marcado como pago.") : uiText("Aprovado."));
      fetchPayouts();
    }
    setActing(null);
  };

  const reject = (id: string) => {
    const reason = window.prompt(uiText('Motivo da rejeição (opcional). O Kumbu é devolvido ao criador:'));
    if (reason === null) return; // cancelled
    runAction(id, 'reject', reason || undefined);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3 safe-top">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{uiText("Gestão de pagamentos")}</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-sm">{uiText("Acesso reservado a administradores.")}</AlertDescription>
        </Alert>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as PayoutFilter)}>
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1 text-xs">{uiText("Pendentes")}</TabsTrigger>
            <TabsTrigger value="approved" className="flex-1 text-xs">{uiText("Aprovados")}</TabsTrigger>
            <TabsTrigger value="processed" className="flex-1 text-xs">{uiText("Pagos")}</TabsTrigger>
            <TabsTrigger value="all" className="flex-1 text-xs">{uiText("Todos")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading && <p className="text-sm text-muted-foreground text-center py-8">{uiText("A carregar…")}</p>}

        {!loading && payouts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">{uiText("Sem pedidos.")}</p>
        )}

        <ul className="space-y-3">
          {payouts.map((p) => {
            const st = BADGE_VARIANT[p.status] ?? 'secondary';
            return (
              <li key={p.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {p.amount_kumbu} Kumbu
                      {p.amount_local != null && (
                        <span className="text-muted-foreground font-normal"> · {fmtKz(Number(p.amount_local))}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(p.created_at), "d MMM yyyy · HH:mm")}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{uiText("User: {{value1}}", { value1: (p.user_id) ?? "" })}</p>
                    {p.rejection_reason && (
                      <p className="text-[11px] text-destructive truncate">{uiText("Motivo: {{value1}}", { value1: (p.rejection_reason) ?? "" })}</p>
                    )}
                  </div>
                  <Badge variant={st} className="text-xs shrink-0">{payoutStatus[p.status] ?? p.status}</Badge>
                </div>

                {p.status === 'pending' && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="h-8 text-xs flex-1" disabled={acting === p.id} onClick={() => runAction(p.id, 'approve')}>
                      {acting === p.id && <Loader2 className="h-3 w-3 animate-spin" />}{uiText(" Aprovar")}</Button>
                    <Button size="sm" variant="destructive" className="h-8 text-xs flex-1" disabled={acting === p.id} onClick={() => reject(p.id)}>{uiText("Rejeitar")}</Button>
                  </div>
                )}

                {p.status === 'approved' && (
                  <Button size="sm" className="h-8 text-xs" disabled={acting === p.id} onClick={() => runAction(p.id, 'process')}>
                    {acting === p.id && <Loader2 className="h-3 w-3 animate-spin" />}{uiText(" Marcar como Pago")}</Button>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
