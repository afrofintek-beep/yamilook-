import { Fragment, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { money, type Overview } from './api';

type Entry = Overview['entries'][number];
const labels: Record<string, string> = { topup: 'Carregamento', payment: 'Pagamento', refund: 'Reembolso', withdrawal_completed: 'Levantamento' };
const adjustments = new Set(['reserve', 'withdrawal_rejected', 'withdrawal_cancel_withdrawal']);
const dateOptions = { timeZone: 'Africa/Luanda' };
const dayKey = (value: string | Date) => new Date(value).toLocaleDateString('en-CA', dateOptions);
export function groupMovements(entries: Entry[]) {
  const grouped = new Map<string, Entry>();
  for (const entry of entries) {
    if (adjustments.has(entry.operation)) continue;
    const key = `${entry.operation}:${entry.reference}`;
    const existing = grouped.get(key);
    grouped.set(key, existing ? { ...existing, amount: existing.amount + entry.amount } : { ...entry });
  }
  return [...grouped.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}
function dayLabel(date: string) {
  const now = new Date();
  if (dayKey(date) === dayKey(now)) return 'Hoje';
  if (dayKey(date) === dayKey(new Date(now.getTime() - 86400000))) return 'Ontem';
  return new Date(date).toLocaleDateString('pt-AO', { ...dateOptions, day: 'numeric', month: 'long', year: 'numeric' });
}
export function MovementHistory({ overview, hidden, recent = false, withdrawals }: { overview: Overview; hidden: boolean; recent?: boolean; withdrawals: (pendingOnly: boolean) => ReactNode }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Entry | null>(null);
  const [notice, setNotice] = useState('');
  const title = (entry: Entry) => overview.orders.find(order => order.id === entry.reference)?.description || labels[entry.operation] || 'Movimento';
  const value = (amount: number) => hidden ? '•••• Kz' : `${amount > 0 ? '+' : ''}${money(amount)}`;
  const entries = groupMovements(overview.entries).filter(entry => {
    const matches = `${title(entry)} ${labels[entry.operation] || ''} ${money(entry.amount)} ${entry.reference} ${new Date(entry.created_at).toLocaleDateString('pt-AO', dateOptions)}`.toLowerCase().includes(search.toLowerCase());
    return matches && (filter !== 'in' || entry.amount > 0) && (filter !== 'out' || entry.amount < 0);
  });
  const visible = recent ? entries.slice(0, 5) : entries;
  const pending = overview.orders.filter(order => order.status === 'pending' && Date.parse(order.expires_at) > Date.now());
  async function receipt() {
    if (!selected) return;
    const text = `Yamilook · Comprovativo de TESTE\nValores simulados\n${title(selected)}\n${labels[selected.operation] || 'Movimento'} · Concluído\n${money(selected.amount)}\n${new Date(selected.created_at).toLocaleString('pt-AO', dateOptions)} (Luanda)\nReferência: ${selected.reference}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Comprovativo de teste Yamilook', text });
      else { await navigator.clipboard.writeText(text); setNotice('Comprovativo copiado.'); }
    } catch (error) { if ((error as Error).name !== 'AbortError') setNotice('Não foi possível partilhar o comprovativo.'); }
  }
  return <section className="space-y-3">
    {recent && <div className="flex items-center justify-between"><h2 className="font-semibold">Movimentos recentes</h2><Link className="py-2 text-sm text-primary" to="/payment-point?tab=movements">Ver todos</Link></div>}
    {!recent && <><Input aria-label="Pesquisar movimentos" placeholder="Pesquisar movimentos" value={search} onChange={event => setSearch(event.target.value)} /><div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar movimentos">{[['all', 'Todos'], ['in', 'Entradas'], ['out', 'Saídas'], ['pending', 'Pendentes'], ['withdrawals', 'Levantamentos']].map(([key, label]) => <Button key={key} size="sm" variant={filter === key ? 'default' : 'outline'} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</Button>)}</div></>}
    {filter === 'withdrawals' && withdrawals(false)}
    {filter === 'pending' && <div className="space-y-3">
      {!pending.length && <p className="text-sm text-muted-foreground">Sem pedidos de pagamento pendentes.</p>}
      {pending.filter(order => `${order.description} ${money(order.amount)}`.toLowerCase().includes(search.toLowerCase())).map(order => <Link key={order.id} to={`/payment-point/${order.id}`} className="flex justify-between gap-3 rounded-xl border p-3"><span>{order.description}<small className="block text-muted-foreground">A aguardar pagamento</small></span><strong>{hidden ? '•••• Kz' : money(order.amount)}</strong></Link>)}
      {withdrawals(true)}
    </div>}
    {!['pending', 'withdrawals'].includes(filter) && <>
      {!visible.length && <p className="py-4 text-sm text-muted-foreground">{search ? 'Nenhum movimento encontrado.' : 'Ainda sem movimentos.'}</p>}
      {visible.map((entry, index) => <Fragment key={`${entry.operation}:${entry.reference}`}>
        {(index === 0 || dayKey(visible[index - 1].created_at) !== dayKey(entry.created_at)) && <h3 className="pt-2 text-xs font-medium text-muted-foreground">{dayLabel(entry.created_at)}</h3>}
        <button className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-muted/50" onClick={() => { setSelected(entry); setNotice(''); }}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${entry.amount > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-foreground'}`}>{entry.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title(entry)}</span><span className="block text-xs text-muted-foreground">{labels[entry.operation] || 'Movimento'} · {new Date(entry.created_at).toLocaleTimeString('pt-AO', { ...dateOptions, hour: '2-digit', minute: '2-digit' })}</span></span>
          <strong className="shrink-0 text-sm tabular-nums">{value(entry.amount)}</strong>
        </button>
      </Fragment>)}
    </>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Detalhe do movimento</DialogTitle></DialogHeader>
      {selected && <div className="space-y-4">
        <p className="text-xs text-amber-600 dark:text-amber-400">Ambiente de testes · Valores simulados</p>
        <p className="text-lg font-semibold">{title(selected)}</p><p className="text-3xl font-semibold">{money(selected.amount)}</p>
        <p>{labels[selected.operation] || 'Movimento'} · Concluído</p>
        <p className="text-sm text-muted-foreground">{new Date(selected.created_at).toLocaleString('pt-AO', dateOptions)} · Luanda</p>
        <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Referência</p><p className="break-all text-sm">{selected.reference}</p><Button variant="ghost" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(selected.reference); setNotice('Referência copiada.'); } catch { setNotice('Não foi possível copiar.'); } }}><Copy className="mr-2 h-4 w-4" />Copiar referência</Button></div>
        {overview.orders.some(order => order.id === selected.reference) && <Button asChild variant="outline" className="w-full"><Link to={`/payment-point/${selected.reference}`}>Ver pedido e intervenientes</Link></Button>}
        <Button className="w-full" onClick={() => void receipt()}><Share2 className="mr-2 h-4 w-4" />Partilhar comprovativo</Button>
        <Link className="block py-2 text-center text-sm text-primary" to="/help">Preciso de ajuda</Link>
        {notice && <p role="status" className="text-sm">{notice}</p>}
      </div>}
    </DialogContent></Dialog>
  </section>;
}
