import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, QrCode, Eye, EyeOff, ArrowDownLeft, Plus, ArrowUpRight, Wallet, List, Store, ShieldCheck } from 'lucide-react';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'wallet';
  const tab = ['wallet', 'movements', 'business', 'admin'].includes(requestedTab) ? requestedTab : 'wallet';
  const [hidden, setHidden] = useState(false);
  const [search, setSearch] = useState('');
  function selectTab(next: string) {
    if (id) navigate(`/payment-point?tab=${next}`);
    else setSearchParams({ tab: next });
  }
  function openDialog(next: 'create' | 'scan' | 'topup' | 'withdraw') {
    setError('');
    setDialog(next);
  }
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
  const displayMoney = (value: number) => hidden ? '•••• Kz' : money(value);
  const ownOrders = overview?.orders.filter(item => item.seller_id === user?.id) || [];
  const pendingOrders = ownOrders.filter(item => item.status === 'pending' && new Date(item.expires_at) > new Date());
  const visibleOrders = tab === 'business' ? ownOrders : overview?.orders || [];
  const visibleEntries = overview?.entries.filter(entry => {
    const related = overview.orders.find(item => item.id === entry.reference);
    return `${labels[entry.operation] || entry.operation} ${related?.description || ''} ${money(entry.amount)} ${entry.reference} ${new Date(entry.created_at).toLocaleDateString('pt-AO')}`.toLowerCase().includes(search.toLowerCase());
  }) || [];
  return <div className="min-h-screen bg-background pb-28 safe-top">
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/95 backdrop-blur p-3">
      <Button variant="ghost" className="min-h-11 gap-2" onClick={() => navigate(id ? '/payment-point' : '/feed')}><ArrowLeft className="h-5 w-5" />Voltar</Button>
      <h1 className="flex-1 text-lg font-semibold">Carteira</h1>
      <span className="text-sm text-muted-foreground">Angola · Kz</span>
    </header>
    <main className="max-w-xl mx-auto p-4 space-y-5">
      <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-foreground">
        Ambiente de testes · Valores simulados
      </div>
      {error && <p role="alert" className="rounded-lg border p-3 text-sm">{error}</p>}
      {!wallet && !error && <p>A carregar…</p>}
      {wallet && !id && tab === 'wallet' && <>
        <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Disponível para pagar</p>
            <Button variant="ghost" size="icon" aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'} aria-pressed={hidden} onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</Button>
          </div>
          <p className="text-3xl sm:text-4xl font-semibold tracking-tight break-words">{displayMoney(wallet.purchased + wallet.earned)}</p>
          <div className="grid grid-cols-2 gap-3 border-t border-primary/20 pt-4 text-sm">
            <div><p className="text-muted-foreground">Para levantar</p><p className="font-semibold mt-1">{displayMoney(wallet.earned)}</p></div>
            <div><p className="text-muted-foreground">Reservado</p><p className="font-semibold mt-1">{displayMoney(wallet.reserved)}</p></div>
          </div>
          <details className="text-sm text-muted-foreground"><summary className="cursor-pointer py-1">Como funciona o saldo?</summary><p className="pt-2">Os carregamentos permitem pagar compras. Os ganhos recebidos permitem pagar ou pedir levantamento. O valor reservado corresponde a levantamentos em curso. Estes saldos são de teste e estão separados dos Kumbu de recompensa.</p></details>
        </section>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Pagar', icon: QrCode, action: 'scan' as const },
            { label: 'Receber', icon: ArrowDownLeft, action: 'create' as const },
            { label: 'Carregar', icon: Plus, action: 'topup' as const },
            { label: 'Levantar', icon: ArrowUpRight, action: 'withdraw' as const },
          ].map(action => <Button key={action.action} variant={action.action === 'scan' ? 'default' : 'outline'} className="h-auto min-h-20 flex-col gap-2 px-1 py-3 text-xs sm:text-sm" onClick={() => openDialog(action.action)}><action.icon className="h-5 w-5" />{action.label}</Button>)}
        </div>
        {pendingOrders.length > 0 && <button className="w-full rounded-xl border p-3 text-left text-sm" onClick={() => selectTab('business')}>{pendingOrders.length} pedido(s) por receber <span aria-hidden="true">→</span></button>}
      </>}
      {!id && tab === 'business' && <section className="space-y-3">
        <h2 className="text-xl font-semibold">Meu negócio</h2>
        <div className="rounded-2xl border p-4"><p className="text-sm text-muted-foreground">Pedidos por receber</p><p className="text-2xl font-semibold mt-1">{displayMoney(pendingOrders.reduce((total, item) => total + item.amount, 0))}</p></div>
        <Button className="w-full min-h-12" onClick={() => openDialog('create')}><Plus className="mr-2 h-5 w-5" />Criar cobrança</Button>
        <p className="text-sm text-muted-foreground">Crie um pedido com valor e motivo. Partilhe a ligação ou apresente o QR ao cliente.</p>
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
          {!order.own && wallet && wallet.purchased + wallet.earned < order.amount && <div className="space-y-2"><p>Carregue saldo de teste para pagar este pedido.</p><Button onClick={() => openDialog('topup')}>Carregar saldo</Button></div>}
        </>}
        {order.own && order.status === 'paid' && <Button variant="outline" disabled={busy} onClick={() => {
          if (window.confirm(`Reembolsar ${money(order.amount)} ao comprador?`)) void run('refund', order.id);
        }}>Reembolsar compra</Button>}
      </section>}
      {overview && !id && <>
        {tab === 'business' && <section className="space-y-2"><h2 className="font-semibold">Pedidos</h2>
          {!visibleOrders.length && <p className="text-sm text-muted-foreground">Ainda sem pedidos.</p>}
          {visibleOrders.map(item => <button key={item.id} className="w-full text-left rounded-xl border p-3" onClick={() => navigate(`/payment-point/${item.id}`)}>
            <span className="block font-medium">{item.description} · {displayMoney(item.amount)}</span>
            <span className="text-sm text-muted-foreground">{item.seller_id === user?.id ? 'A receber' : 'Compra'} · {labels[item.status]}</span>
          </button>)}
        </section>}
        {(tab === 'movements' || (tab === 'admin' && overview.admin)) && <section className="space-y-2"><h2 className="font-semibold">{tab === 'admin' ? 'Gerir levantamentos' : 'Meus levantamentos'}</h2>
          {!overview.withdrawals.filter(item => tab === 'admin' || item.user_id === user?.id).length && <p className="text-sm text-muted-foreground">Ainda sem levantamentos.</p>}
          {overview.withdrawals.filter(item => tab === 'admin' || item.user_id === user?.id).map(item => <div key={item.id} className="rounded-xl border p-3 space-y-2">
            <p>{displayMoney(item.amount)} · {labels[item.status]}</p><p className="text-sm break-all">{item.destination}</p>
            {item.evidence && <p className="text-sm">{item.evidence}</p>}
            {item.user_id === user?.id && item.status === 'pending' && <Button variant="outline" disabled={busy} onClick={() => run('cancel_withdrawal', item.id)}>Cancelar</Button>}
            {tab === 'admin' && overview.admin && item.status === 'pending' && <Button disabled={busy} onClick={() => run('processing', item.id)}>Iniciar processamento</Button>}
            {tab === 'admin' && overview.admin && item.status === 'processing' && <Button disabled={busy} onClick={() => {
              const evidence = window.prompt('Referência de confirmação do levantamento simulado');
              if (evidence) void run('completed', item.id, undefined, evidence);
            }}>Concluir teste</Button>}
            {tab === 'admin' && overview.admin && ['pending', 'processing'].includes(item.status) && <Button variant="outline" disabled={busy} onClick={() => {
              const reason = window.prompt('Motivo da rejeição'); if (reason) void run('rejected', item.id, undefined, reason);
            }}>Rejeitar</Button>}
          </div>)}
        </section>}
        {(tab === 'wallet' || tab === 'movements') && <section className="space-y-2">
          <div className="flex items-center justify-between"><h2 className="font-semibold">{tab === 'wallet' ? 'Movimentos recentes' : 'Movimentos'}</h2>{tab === 'wallet' && <Button variant="ghost" onClick={() => selectTab('movements')}>Ver todos</Button>}</div>
          {tab === 'movements' && <Input aria-label="Pesquisar movimentos" placeholder="Pesquisar motivo, valor, data ou referência" value={search} onChange={event => setSearch(event.target.value)} />}
          {overview.entries.length > 0 && visibleEntries.length === 0 && <p className="text-sm text-muted-foreground">Nenhum movimento encontrado.</p>}
          {!overview.entries.length && <p className="text-sm text-muted-foreground">Ainda sem movimentos.</p>}
          {(tab === 'wallet' ? visibleEntries.slice(0, 5) : visibleEntries).map(entry => <div key={entry.id} className="border-b py-2 text-sm">
            <div className="flex justify-between gap-3"><span>{labels[entry.operation] || entry.operation}{overview.orders.find(item => item.id === entry.reference)?.description && <span className="block text-xs text-muted-foreground">{overview.orders.find(item => item.id === entry.reference)?.description}</span>}</span><strong className="whitespace-nowrap">{displayMoney(entry.amount)}</strong></div>
            <p className="text-xs text-muted-foreground break-all">{new Date(entry.created_at).toLocaleString('pt-AO')} · {entry.reference}</p>
          </div>)}
        </section>}
      </>}
    </main>
    <nav aria-label="Navegação da carteira" className="fixed bottom-0 inset-x-0 z-20 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-xl justify-around p-2">
        {[
          { key: 'wallet', label: 'Carteira', icon: Wallet },
          { key: 'movements', label: 'Movimentos', icon: List },
          { key: 'business', label: 'Negócio', icon: Store },
          ...(overview?.admin ? [{ key: 'admin', label: 'Gestão', icon: ShieldCheck }] : []),
        ].map(item => <Button key={item.key} variant="ghost" aria-current={!id && tab === item.key ? 'page' : undefined} className={`h-auto min-h-14 flex-1 flex-col gap-1 px-1 text-xs ${!id && tab === item.key ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`} onClick={() => selectTab(item.key)}><item.icon className="h-5 w-5" />{item.label}</Button>)}
      </div>
    </nav>
    <Dialog open={!!dialog} onOpenChange={open => { if (!open && !busy) { setDialog(null); setError(''); } }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>
        {dialog === 'create' ? 'Receber pagamento de teste' : dialog === 'scan' ? 'Ler QR' : dialog === 'topup' ? 'Carregar saldo de teste' : 'Pedir levantamento de teste'}
      </DialogTitle></DialogHeader>
      {dialog === 'create' && <RequestPayment onCreated={async newId => { setDialog(null); navigate(`/payment-point/${newId}`); }} />}
      {dialog === 'scan' && <ScanPayment onScan={newId => { setDialog(null); navigate(`/payment-point/${newId}`); }} />}
      {(dialog === 'topup' || dialog === 'withdraw') && <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Esta operação utiliza valores simulados.</p>
        {dialog === 'withdraw' && <p className="text-sm">Disponível para levantamento: {money(wallet?.earned || 0)}. Apenas os ganhos recebidos são elegíveis neste piloto.</p>}
        <label className="block text-sm">Valor em kwanzas<Input value={amount} inputMode="decimal" disabled={busy} onChange={e => { setAmount(e.target.value); requestId.current = crypto.randomUUID(); }} /></label>
        {dialog === 'withdraw' && <label className="block text-sm">Destino de teste<Input placeholder="Ex. Conta de teste Maria" value={destination} disabled={busy} maxLength={120} onChange={e => { setDestination(e.target.value); requestId.current = crypto.randomUUID(); }} /></label>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button disabled={busy || (dialog === 'withdraw' && !wallet?.earned)} onClick={() => submitAmount(dialog === 'topup' ? 'topup' : 'withdraw')}>{busy ? 'A processar…' : 'Confirmar teste'}</Button>
      </div>}
      </DialogContent>
    </Dialog>
  </div>;
}
