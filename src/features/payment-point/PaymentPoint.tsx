import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { paymentAction, money, parseAmount, orderLink, type Overview, type PaymentOrder } from './api';
import { RequestPayment } from './RequestPayment';
import { ScanPayment } from './ScanPayment';

const labels: Record<string, string> = {
  pending: 'Pendente', processing: 'Em processamento', completed: 'Concluído', rejected: 'Rejeitado',
  cancelled: 'Cancelado', paid: 'Pagamento confirmado', refunded: 'Reembolsado',
  topup: 'Carregamento de teste', payment: 'Pagamento', refund: 'Reembolso', reserve: 'Reserva para levantamento',
  withdrawal_completed: 'Levantamento de teste', withdrawal_rejected: 'Reserva devolvida', withdrawal_cancel_withdrawal: 'Reserva devolvida',
};
export default function PaymentPoint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview>();
  const [order, setOrder] = useState<PaymentOrder>();
  const [dialog, setDialog] = useState<'create' | 'scan' | 'topup' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const refresh = useCallback(async () => {
    const summary = await paymentAction<Overview>('overview');
    setOverview(summary);
    if (id) setOrder(await paymentAction<PaymentOrder>('view', id));
  }, [id]);
  useEffect(() => {
    let active = true;
    setOrder(undefined); setError('');
    const load = async () => {
      try {
        const summary = await paymentAction<Overview>('overview');
        const selected = id ? await paymentAction<PaymentOrder>('view', id) : undefined;
        if (active) { setOverview(summary); setOrder(selected); setError(''); }
      } catch (e) { if (active) setError((e as Error).message); }
    };
    void load(); const timer = setInterval(load, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [id]);
  async function run(action: string, reference?: string, cents?: number, text?: string) {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError('');
    try {
      await paymentAction(action, reference, cents, text);
      requestId.current = crypto.randomUUID(); setDialog(null); setAmount(''); setDestination('');
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { actionLock.current = false; setBusy(false); }
  }
  function submitAmount(action: string) {
    try { void run(action, requestId.current, parseAmount(amount), destination); }
    catch (e) { setError((e as Error).message); }
  }
  async function share() {
    if (!id) return;
    try {
      const url = orderLink(id);
      if (navigator.share) await navigator.share({ title: 'Pedido de pagamento de teste', url });
      else { await navigator.clipboard.writeText(url); setError('Ligação copiada.'); }
    } catch (e) { if ((e as Error).name !== 'AbortError') setError('Não foi possível partilhar a ligação.'); }
  }
  const wallet = overview?.wallet;
  return <div className="min-h-screen bg-background pb-24 safe-top">
    <header className="flex items-center gap-3 border-b p-4">
      <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate(id ? '/payment-point' : '/kumbu')}><ArrowLeft /></Button>
      <h1 className="text-lg font-semibold">Payment Point · Angola</h1>
    </header>
    <main className="max-w-xl mx-auto p-4 space-y-5">
      <div role="status" className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
        Angola · AOA · Ambiente de testes. Os valores e os levantamentos são simulados. A activação financeira está pendente das condições acordadas com os parceiros.
      </div>
      {error && <p role="alert" className="rounded-lg border p-3 text-sm">{error}</p>}
      {!wallet && !error && <p>A carregar…</p>}
      {wallet && <section className="rounded-2xl border p-5 space-y-3">
        <p className="text-sm text-muted-foreground">Disponível para pagar · teste</p>
        <p className="text-3xl font-semibold">{money(wallet.purchased + wallet.earned)}</p>
        <p className="text-sm">Deste saldo, {money(wallet.earned)} está disponível para levantamento de teste.</p>
        <p className="text-sm text-muted-foreground">Reservado {money(wallet.reserved)}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setError(''); setDialog('topup'); }}>Carregar teste</Button>
          <Button variant="outline" onClick={() => setDialog('create')}>Receber</Button>
          <Button variant="outline" onClick={() => setDialog('scan')}><QrCode className="mr-2 h-4 w-4" />Ler QR</Button>
          <Button variant="outline" disabled={wallet.earned <= 0} onClick={() => setDialog('withdraw')}>Levantar teste</Button>
        </div>
      </section>}
      {order && <section className="rounded-2xl border p-5 space-y-4">
        <h2 className="font-semibold">Pedido de pagamento</h2>
        <p>Recebe {order.seller_name || 'Utilizador Yamilook'}</p>
        <p className="text-2xl font-semibold">{money(order.amount)}</p><p>{order.description}</p>
        <p>{labels[order.status]} · teste</p>
        <p className="text-xs text-muted-foreground">Válido até {new Date(order.expires_at).toLocaleString('pt-AO')}</p>
        {order.status === 'pending' && new Date(order.expires_at) > new Date() && <>
          {order.own ? <>
            <div className="bg-white p-4 rounded-lg w-fit"><QRCodeSVG value={orderLink(order.id)} size={200} /></div>
            <Button onClick={share}>Partilhar pedido</Button>
            <Button variant="outline" disabled={busy} onClick={() => run('cancel', order.id)}>Cancelar pedido</Button>
          </> : <Button disabled={busy || !wallet || wallet.purchased + wallet.earned < order.amount} onClick={() => run('pay', order.id)}>Confirmar pagamento de teste</Button>}
          {!order.own && wallet && wallet.purchased + wallet.earned < order.amount && <p>Carregue saldo de teste para pagar este pedido.</p>}
        </>}
        {order.own && order.status === 'paid' && <Button variant="outline" disabled={busy} onClick={() => {
          if (window.confirm(`Reembolsar ${money(order.amount)} ao comprador?`)) void run('refund', order.id);
        }}>Reembolsar compra</Button>}
      </section>}
      {overview && <>
        <section className="space-y-2"><h2 className="font-semibold">Pedidos</h2>
          {!overview.orders.length && <p className="text-sm text-muted-foreground">Ainda sem pedidos.</p>}
          {overview.orders.map(item => <button key={item.id} className="w-full text-left rounded-xl border p-3" onClick={() => navigate(`/payment-point/${item.id}`)}>
            <span className="block font-medium">{item.description} · {money(item.amount)}</span>
            <span className="text-sm text-muted-foreground">{item.seller_id === user?.id ? 'A receber' : 'Compra'} · {labels[item.status]}</span>
          </button>)}
        </section>
        <section className="space-y-2"><h2 className="font-semibold">Levantamentos de teste {overview.admin && '· Administração'}</h2>
          {!overview.withdrawals.length && <p className="text-sm text-muted-foreground">Ainda sem levantamentos.</p>}
          {overview.withdrawals.map(item => <div key={item.id} className="rounded-xl border p-3 space-y-2">
            <p>{money(item.amount)} · {labels[item.status]}</p><p className="text-sm break-all">{item.destination}</p>
            {item.evidence && <p className="text-sm">{item.evidence}</p>}
            {item.user_id === user?.id && item.status === 'pending' && <Button variant="outline" disabled={busy} onClick={() => run('cancel_withdrawal', item.id)}>Cancelar</Button>}
            {overview.admin && item.status === 'pending' && <Button disabled={busy} onClick={() => run('processing', item.id)}>Iniciar processamento</Button>}
            {overview.admin && item.status === 'processing' && <Button disabled={busy} onClick={() => {
              const evidence = window.prompt('Referência de confirmação do levantamento simulado');
              if (evidence) void run('completed', item.id, undefined, evidence);
            }}>Concluir teste</Button>}
            {overview.admin && ['pending', 'processing'].includes(item.status) && <Button variant="outline" disabled={busy} onClick={() => {
              const reason = window.prompt('Motivo da rejeição'); if (reason) void run('rejected', item.id, undefined, reason);
            }}>Rejeitar</Button>}
          </div>)}
        </section>
        <section className="space-y-2"><h2 className="font-semibold">Movimentos</h2>
          {!overview.entries.length && <p className="text-sm text-muted-foreground">Ainda sem movimentos.</p>}
          {overview.entries.map(entry => <div key={entry.id} className="border-b py-2 text-sm">
            <div className="flex justify-between gap-3"><span>{labels[entry.operation] || entry.operation}</span><strong>{money(entry.amount)}</strong></div>
            <p className="text-xs text-muted-foreground break-all">{new Date(entry.created_at).toLocaleString('pt-AO')} · {entry.reference}</p>
          </div>)}
        </section>
      </>}
    </main>
    <Dialog open={!!dialog} onOpenChange={open => { if (!open && !busy) { setDialog(null); setError(''); } }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>
        {dialog === 'create' ? 'Receber pagamento de teste' : dialog === 'scan' ? 'Ler QR' : dialog === 'topup' ? 'Carregar saldo de teste' : 'Pedir levantamento de teste'}
      </DialogTitle></DialogHeader>
      {dialog === 'create' && <RequestPayment onCreated={async newId => { setDialog(null); navigate(`/payment-point/${newId}`); }} />}
      {dialog === 'scan' && <ScanPayment onScan={newId => { setDialog(null); navigate(`/payment-point/${newId}`); }} />}
      {(dialog === 'topup' || dialog === 'withdraw') && <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Esta operação utiliza valores simulados.</p>
        <label className="block text-sm">Valor em kwanzas<Input value={amount} inputMode="decimal" disabled={busy} onChange={e => { setAmount(e.target.value); requestId.current = crypto.randomUUID(); }} /></label>
        {dialog === 'withdraw' && <label className="block text-sm">Destino de teste<Input placeholder="Ex. Conta de teste Maria" value={destination} disabled={busy} maxLength={120} onChange={e => { setDestination(e.target.value); requestId.current = crypto.randomUUID(); }} /></label>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button disabled={busy} onClick={() => submitAmount(dialog === 'topup' ? 'topup' : 'withdraw')}>{busy ? 'A processar…' : 'Confirmar teste'}</Button>
      </div>}
      </DialogContent>
    </Dialog>
  </div>;
}
