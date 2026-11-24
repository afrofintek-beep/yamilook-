import { useReceiveLabels } from '@/features/payment-point/receive-labels';
import { ReceiveOptions } from './ReceiveOptions';
import { useMessageNotification } from '@/hooks/useMessageNotification';
import { PaymentRejected } from './api';
import { WalletSessionConfirmation } from './WalletSessionConfirmation';
import { TransferSecurity, preferences } from './TransferSecurity';
import { WalletHeader, WalletNavigation } from './WalletNavigation';
import { useHiddenBalance } from './useHiddenBalance';
import { MovementHistory } from './MovementHistory';
import { WalletAccessManager } from './WalletAccess';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Eye, EyeOff, ArrowDownLeft, Plus, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { paymentAction, money, parseAmount, orderLink, type Overview, type PaymentOrder } from './api';
import { RequestPayment } from './RequestPayment';
import { ScanPayment } from './ScanPayment';
import { AppyPaySandbox } from './AppyPaySandbox';
import { useAppyPayLabels } from './appypay-labels';
import type { AppyPayAttempt } from './appypay-api';

const labels: Record<string, string> = {
  pending: 'Pendente', processing: 'Em processamento', completed: 'Concluído', rejected: 'Rejeitado',
  cancelled: 'Cancelado', paid: 'Pagamento confirmado', refunded: 'Reembolsado',
  topup: 'Carregamento de teste', payment: 'Pagamento', refund: 'Reembolso', reserve: 'Reserva para levantamento',
  withdrawal_completed: 'Levantamento de teste', withdrawal_rejected: 'Reserva devolvida', withdrawal_cancel_withdrawal: 'Reserva devolvida',
};
export default function PaymentPoint() {
  const { id } = useParams();
  const copy = useReceiveLabels();
  const appyCopy = useAppyPayLabels();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'wallet';
  const tab = ['wallet', 'movements', 'business', 'admin'].includes(requestedTab) ? requestedTab : 'wallet';
  const [hidden, setHidden] = useHiddenBalance();
  function selectTab(next: string) {
    if (id) navigate(`/payment-point?tab=${next}`);
    else setSearchParams({ tab: next });
  }
  const [activeAction, setActiveAction] = useState<'create' | 'scan' | 'topup' | 'withdraw'>('scan');
  function openDialog(next: typeof activeAction) {
    setActiveAction(next);
    setError('');
    setDialog(next);
  }
  const { user } = useAuth();
  const [outgoingBlocked, setOutgoingBlocked] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<Overview>();
  const [order, setOrder] = useState<PaymentOrder>();
  const [externalOrderBlocked, setExternalOrderBlocked] = useState(false);
  const [externalTopupBlocked, setExternalTopupBlocked] = useState(false);
  const [externalAttempt, setExternalAttempt] = useState<AppyPayAttempt | null>(null);
  const { notifyMessage } = useMessageNotification();
  const pendingSellerOrder = useRef<string>();
  useEffect(() => {
    if (!order?.own || order.id !== id) return;
    if (order.status === 'pending') pendingSellerOrder.current = order.id;
    if (['paid', 'confirmed'].includes(order.status) && pendingSellerOrder.current === order.id) {
      pendingSellerOrder.current = undefined;
      const key = 'massa-receipt:' + order.id;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        notifyMessage();
      }
    }
  }, [order, id, notifyMessage]);
  const [dialog, setDialog] = useState<'create' | 'scan' | 'topup' | 'withdraw' | 'info' | 'security' | null>(() => {
    const action = searchParams.get('action');
    return !id && (action === 'scan' || action === 'create') ? action : null;
  });
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [confirmSession, setConfirmSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const pendingKey = 'wallet-pending:' + user?.id;
  const actionLock = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const refresh = useCallback(async () => {
    const summary = await paymentAction<Overview>('overview');
    setOverview(summary);
    if (id) setOrder(await paymentAction<PaymentOrder>('view', id));
  }, [id]);
  useEffect(() => {
    let active = true;
    setOrder(undefined); setError(''); setOutgoingBlocked(null);
    const load = async () => {
      try {
        const [summary, security] = await Promise.all([
          paymentAction<Overview>('overview'), preferences(),
        ]);
        const selected = id ? await paymentAction<PaymentOrder>('view', id) : undefined;
        if (active) {
          const saved = sessionStorage.getItem(pendingKey);
          if (saved) {
            const { reference, action } = JSON.parse(saved);
            const operation = action === 'pay' ? 'payment' : action === 'withdraw' ? 'reserve' : 'refund';
            if (summary.entries.some(item => item.reference === reference && item.operation === operation)
                || (action === 'withdraw' && summary.withdrawals.some(item => item.id === reference))) {
              sessionStorage.removeItem(pendingKey);
              setUncertain(false);
            } else setUncertain(true);
          } else setUncertain(false);
          setOutgoingBlocked(security.blocked);
          setOverview(summary); setOrder(selected); setError(''); }
      } catch (e) { if (active) setError((e as Error).message); }
    };
    void load(); const timer = setInterval(load, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [id,pendingKey]);
  async function run(action: string, reference?: string, cents?: number, text?: string) {
    if ((action === 'pay' || action === 'cancel') && externalOrderBlocked) return;
    if (action === 'topup' && externalTopupBlocked) return;
    if (action === 'refund' && (order?.payment_provider === 'appypay' || externalAttempt?.state === 'confirmed')) return;
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError('');
    let submitted = false;
    try {
      if (action === 'pay' || action === 'withdraw' || action === 'refund') {
        const security = await preferences();
        setOutgoingBlocked(security.blocked);
        if (security.blocked) throw new Error('As saídas de dinheiro estão bloqueadas');
        const destination = action === 'withdraw' ? text?.trim() : action === 'refund' ? order?.buyer_id : order?.seller_id;
        const amount = action === 'withdraw' ? cents : order?.amount;
        if (!reference || !destination || !amount) throw new Error('Confirme o destino e o valor da operação.');
        const { authorizeDebit, WalletSessionVerificationRequired } = await import('./authorize');
        const saved = sessionStorage.getItem(pendingKey);
        const operation = JSON.stringify({action,reference,cents,text});
        if (saved && operation !== saved) throw new Error('Consulte primeiro o resultado da operação anterior.');
        try {
          await authorizeDebit({action, id:reference, amount, destination, currency:'AOA'});
        } catch (error) {
          if (error instanceof WalletSessionVerificationRequired) {
            setConfirmSession(true);
            return;
          }
          throw error;
        }
        sessionStorage.setItem(pendingKey,operation);
        submitted = true;
      }
      await paymentAction(action, reference, cents, text);
      if (submitted) { sessionStorage.removeItem(pendingKey); setUncertain(false); }
      submitted = false;
      requestId.current = crypto.randomUUID(); setDialog(null); setAmount(''); setDestination('');
      await refresh();
    } catch (e) {
      if (submitted && !(e instanceof PaymentRejected)) setUncertain(true);
      else {
        if (submitted) {sessionStorage.removeItem(pendingKey); setUncertain(false);}
        setError((e as Error).message);
      }
    }
    finally { actionLock.current = false; setBusy(false); }
  }
  function submitAmount(action: string) {
    try {
      const cents = parseAmount(amount);
      if (action === 'withdraw' && !window.confirm('Levantar '+money(cents)+' para '+destination.trim()+'? Comissão de teste '+money(0)+'.')) return;
      void run(action, requestId.current, cents, destination);
    }
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
  const debitUnavailable = outgoingBlocked !== false;
  const securityNotice = outgoingBlocked === true && <div role="status" className="rounded-lg border p-3 space-y-2">
    <p>As saídas de dinheiro estão bloqueadas.</p>
    <Button variant="outline" onClick={() => { setError(''); setDialog('security'); }}>Abrir segurança</Button>
  </div>;
  const wallet = overview?.wallet;
  const displayMoney = (value: number) => hidden ? '•••• Kz' : money(value);
  const ownOrders = overview?.orders.filter(item => item.seller_id === user?.id) || [];
  const pendingOrders = ownOrders.filter(item => item.status === 'pending' && new Date(item.expires_at) > new Date());
  const visibleOrders = tab === 'business' ? ownOrders : overview?.orders || [];
  const parsedTopupAmount = (() => { try { return parseAmount(amount); } catch { return undefined; } })();
  const externalOrderConfirmed = order?.status === 'confirmed'
    || (order?.payment_provider === 'appypay' && order?.status === 'paid')
    || (externalAttempt?.order_id === order?.id && externalAttempt?.state === 'confirmed');
  function renderWithdrawals(pendingOnly: boolean) {
    if (!overview) return null;
    return <section className="space-y-2"><h2 className="font-semibold">{tab === 'admin' ? 'Gerir levantamentos' : pendingOnly ? 'Levantamentos em curso' : 'Meus levantamentos'}</h2>
          {!overview.withdrawals.filter(item => (tab === 'admin' || item.user_id === user?.id) && (!pendingOnly || ['pending', 'processing'].includes(item.status))).length && <p className="text-sm text-muted-foreground">Ainda sem levantamentos.</p>}
          {overview.withdrawals.filter(item => (tab === 'admin' || item.user_id === user?.id) && (!pendingOnly || ['pending', 'processing'].includes(item.status))).map(item => <div key={item.id} className="rounded-xl border p-3 space-y-2">
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
        </section>;
  }
  return <div className="min-h-screen bg-background pb-28 safe-top">
    <WalletHeader security={() => setDialog('security')} section={id ? 'order' : tab} admin={overview?.admin} back={id ? '/payment-point' : '/feed'} />
    <main className="max-w-xl mx-auto p-4 space-y-4">
      <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-foreground">
        Ambiente de testes · Valores simulados
      </div>
      {securityNotice}
      {uncertain && <div role="status" className="rounded-lg border p-3">
        <p>A confirmar a operação. A carteira consulta o estado automaticamente.</p>
        <Button disabled={busy || debitUnavailable} variant="outline" onClick={()=>{
          const saved = sessionStorage.getItem(pendingKey);
          if (!saved) return;
          const pending = JSON.parse(saved);
          if (pending.action !== 'withdraw' && order?.id !== pending.reference) {
            navigate('/payment-point/'+pending.reference); return;
          }
          if (window.confirm(pending.action === 'withdraw' ? 'Confirmar levantamento de '+money(pending.cents)+' para '+pending.text+'?' : 'Confirmar novamente a operação de '+money(order!.amount)+' com a referência original?')) {
            void run(pending.action,pending.reference,pending.cents,pending.text);
          }
        }}>Rever operação pendente</Button>
      </div>}
      {error && <p role="alert" className="rounded-lg border p-3 text-sm">{error}</p>}
      {!wallet && !error && <p>A carregar…</p>}
      {wallet && !id && tab === 'wallet' && <>
        <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-background p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Disponível para pagar</p>
            <Button variant="ghost" size="icon" aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'} aria-pressed={hidden} onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</Button>
          </div>
          <p className="text-3xl sm:text-4xl font-semibold tracking-tight break-words">{displayMoney(wallet.purchased + wallet.earned)}</p>
          <div className="grid grid-cols-2 gap-3 border-t border-primary/20 pt-3 text-sm">
            <div><p className="text-muted-foreground">Para levantar</p><p className="font-semibold mt-1">{displayMoney(wallet.earned)}</p></div>
            <div><p className="text-muted-foreground">Reservado</p><p className="font-semibold mt-1">{displayMoney(wallet.reserved)}</p></div>
          </div>
          <button className="py-1 text-sm text-primary" onClick={() => setDialog('info')}>Sobre o saldo</button>
        </section>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Pagar', icon: QrCode, action: 'scan' as const },
            { label: copy.receive, icon: ArrowDownLeft, action: 'create' as const },
            { label: 'Carregar', icon: Plus, action: 'topup' as const },
            { label: 'Levantar', icon: ArrowUpRight, action: 'withdraw' as const },
          ].map(action => <Button key={action.action} variant={action.action === activeAction ? 'default' : 'outline'} className={`transition-colors motion-reduce:transition-none h-auto min-h-16 flex-col gap-1.5 px-1 py-2 text-xs sm:text-sm border-border ${action.action === activeAction ? 'text-primary-foreground' : 'text-foreground'}`} onClick={() => openDialog(action.action)}><action.icon className="h-5 w-5" />{action.label}</Button>)}
        </div>
        {pendingOrders.length > 0 && <button className="w-full rounded-xl border p-3 text-left text-sm" onClick={() => selectTab('business')}>Cobranças que criei ({pendingOrders.length}) <span aria-hidden="true">→</span></button>}
      </>}
      {!id && tab === 'business' && <section className="space-y-3">
        <Button variant="outline" onClick={() => navigate('/facturacao')}>Facturação de teste</Button>
        <div className="rounded-2xl border p-4"><p className="text-sm text-muted-foreground">Total das minhas cobranças pendentes</p><p className="text-2xl font-semibold mt-1">{displayMoney(pendingOrders.reduce((total, item) => total + item.amount, 0))}</p></div>
        <Button className="w-full min-h-12" onClick={() => openDialog('create')}><Plus className="mr-2 h-5 w-5" />Criar cobrança</Button>
        <p className="text-sm text-muted-foreground">Crie um pedido com valor e motivo. Partilhe a ligação ou apresente o QR ao cliente.</p>
      </section>}
      {order && <section className="rounded-2xl border p-4 space-y-3">
        <h2 className="font-semibold">{order.status === 'paid' ? 'Comprovativo de pagamento simulado' : copy.testRequest}</h2>
        {order.status === 'paid' && <p className="break-all text-xs">Referência: {order.id}</p>}
        <p>Recebe {order.seller_name || 'Utilizador Yamilook'} · carteira …{order.seller_id.slice(-6)}</p>
        <p className="text-sm">Comissão de teste {money(0)} · Total {money(order.amount)}</p>
        <p className="text-2xl font-semibold">{money(order.amount)}</p><p className="break-words">Motivo: {order.description}</p>
        <p role="status">{externalOrderConfirmed ? appyCopy.states.confirmed + ' · ' + money(order.amount) : order.status === 'paid'
          ? (order.own ? copy.received : 'Pagamento simulado concluído') + ' · ' + money(order.amount)
          : order.status === 'pending' && order.own
            ? (Date.parse(order.expires_at) > Date.now() ? copy.awaiting : 'Pedido expirado')
            : labels[order.status] + ' · teste'}</p>
        <p className="text-xs text-muted-foreground">Válido até {new Date(order.expires_at).toLocaleString('pt-AO')}</p>
        {user && <AppyPaySandbox key={`${user.id}:${order.id}`} userId={user.id} orderId={order.id} amountMinor={order.amount}
          readOnly={!!order.own} canCreate={!busy && !uncertain && order.status === 'pending' && Date.parse(order.expires_at) > Date.now()}
          onConfirmed={refresh} onBlockedChange={setExternalOrderBlocked} onAttempt={setExternalAttempt} />}
        {order.status === 'pending' && new Date(order.expires_at) > new Date() && <>
          {order.own ? <>
            <div className="bg-white p-4 rounded-lg w-fit"><QRCodeSVG value={orderLink(order.id)} size={200} /></div>
            <Button onClick={share}>{copy.share}</Button>
            <Button variant="outline" disabled={busy || externalOrderBlocked} onClick={() => run('cancel', order.id)}>Cancelar pedido</Button>
          </> : <Button disabled={busy || debitUnavailable || externalOrderBlocked || !wallet || wallet.purchased + wallet.earned < order.amount} onClick={() => run('pay', order.id)}>Confirmar simulação</Button>}
          {!order.own && wallet && wallet.purchased + wallet.earned < order.amount && <div className="space-y-2"><p>Carregue saldo de teste para pagar este pedido.</p><Button onClick={() => openDialog('topup')}>Carregar saldo</Button></div>}
        </>}
        {order.own && order.status === 'paid' && order.payment_provider !== 'appypay' && !externalOrderConfirmed && <Button variant="outline" disabled={busy || debitUnavailable} onClick={() => {
          if (window.confirm(`Reembolsar ${money(order.amount)} ao comprador?`)) void run('refund', order.id);
        }}>Reembolsar compra</Button>}
      </section>}
      {overview && !id && <>
        {tab === 'admin' && overview.admin && <WalletAccessManager />}
        {tab === 'business' && <section className="space-y-2"><h2 className="font-semibold">Pedidos</h2>
          {!visibleOrders.length && <p className="text-sm text-muted-foreground">Ainda sem pedidos.</p>}
          {visibleOrders.map(item => <button key={item.id} className="w-full text-left rounded-xl border p-3" onClick={() => navigate(`/payment-point/${item.id}`)}>
            <span className="block font-medium">{item.description} · {displayMoney(item.amount)}</span>
            <span className="text-sm text-muted-foreground">{item.seller_id === user?.id ? 'A receber' : 'Compra'} · {item.status === 'confirmed' ? appyCopy.states.confirmed : labels[item.status]}</span>
          </button>)}
        </section>}
        {tab === 'admin' && overview.admin && renderWithdrawals(false)}
        {(tab === 'wallet' || tab === 'movements') && <MovementHistory overview={overview} hidden={hidden} recent={tab === 'wallet'} withdrawals={renderWithdrawals} />}
      </>}
    </main>
    {confirmSession && <WalletSessionConfirmation onClose={() => setConfirmSession(false)} />}
    <WalletNavigation tab={id ? '' : tab} />
    <Dialog open={!!dialog} onOpenChange={open => { if (!open && !busy) { setDialog(null); setError(''); } }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>
        {dialog === 'security' ? 'Segurança das transferências' : dialog === 'info' ? 'Sobre o saldo' : dialog === 'create' ? (tab === 'business' ? copy.request : copy.how) : dialog === 'scan' ? 'Ler QR' : dialog === 'topup' ? 'Carregar saldo de teste' : 'Pedir levantamento de teste'}
      </DialogTitle></DialogHeader>
      {dialog === 'security' && <TransferSecurity onChange={value => { setOutgoingBlocked(value.blocked); setError(''); }} />}
      {dialog === 'info' && <div className="space-y-3 text-sm">
        <p><strong>Disponível para pagar</strong> reúne os carregamentos e os ganhos recebidos.</p>
        <p><strong>Para levantar</strong> indica os ganhos elegíveis para levantamento neste piloto.</p>
        <p><strong>Reservado</strong> corresponde a pedidos de levantamento em curso.</p>
        <p>Os valores em kwanzas deste ambiente são simulados. Os Kumbu têm saldo e regras próprios.</p>
      </div>}
      {dialog === 'create' && tab !== 'business' && <ReceiveOptions onCreated={async newId => { setDialog(null); navigate(`/payment-point/${newId}`); }} />}
      {dialog === 'create' && tab === 'business' && <RequestPayment business onCreated={async newId => { setDialog(null); navigate(`/payment-point/${newId}`); }} />}
      {dialog === 'scan' && <ScanPayment onScan={newId => { setDialog(null); navigate(`/payment-point/${newId}`); }} />}
      {(dialog === 'topup' || dialog === 'withdraw') && <div className="space-y-3">
        {dialog === 'withdraw' && securityNotice}
        <p className="text-sm text-muted-foreground">Esta operação utiliza valores simulados.</p>
        {dialog === 'withdraw' && <p className="text-sm">Disponível para levantamento: {money(wallet?.earned || 0)}. Apenas os ganhos recebidos são elegíveis neste piloto.</p>}
        <label className="block text-sm">Valor em kwanzas<Input value={amount} inputMode="decimal" disabled={busy || (dialog === 'topup' && externalTopupBlocked)} onChange={e => { setAmount(e.target.value); requestId.current = crypto.randomUUID(); }} /></label>
        {dialog === 'withdraw' && <label className="block text-sm">Destino de teste<Input placeholder="Ex. Conta de teste Maria" value={destination} disabled={busy} maxLength={120} onChange={e => { setDestination(e.target.value); requestId.current = crypto.randomUUID(); }} /></label>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {dialog === 'topup' ? <>
          <div className="rounded-xl border p-3 space-y-2">
            <h3 className="text-sm font-semibold">{appyCopy.localTitle}</h3>
            <p className="text-sm text-muted-foreground">{appyCopy.localNote}</p>
            <Button variant="outline" disabled={busy || externalTopupBlocked} onClick={() => submitAmount('topup')}>{busy ? appyCopy.states.submitting : appyCopy.localAction}</Button>
          </div>
          {user && <AppyPaySandbox key={`${user.id}:topup`} userId={user.id} amountMinor={parsedTopupAmount} canCreate={!busy}
            onConfirmed={refresh} onBlockedChange={setExternalTopupBlocked} />}
        </> : <Button disabled={busy || debitUnavailable || !wallet?.earned} onClick={() => submitAmount('withdraw')}>{busy ? 'A processar…' : 'Confirmar teste'}</Button>}
      </div>}
      </DialogContent>
    </Dialog>
  </div>;
}
