import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { paymentAction, parseAmount, orderLink, money } from './api';

export function RequestPayment({ onCreated }: { onCreated: (id: string, message: string) => Promise<void> }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ id: string; amount: number; description: string } | null>(null);
  async function create() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const cents = parseAmount(amount);
      const reason = description.trim();
      if (!reason) throw new Error('Indique o produto ou serviço.');
      if (!pending.current || pending.current.amount !== cents || pending.current.description !== reason) {
        pending.current = { id: crypto.randomUUID(), amount: cents, description: reason };
      }
      const request = pending.current;
      await paymentAction('merchant');
      await paymentAction('create', request.id, cents, reason);
      await onCreated(request.id, `Pedido de pagamento · TESTE\n${reason}\n${money(cents)}\nPagar pedido: ${orderLink(request.id)}`);
      pending.current = null; setAmount(''); setDescription('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar o pedido.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Carteira Angola · AOA. Pedido de teste, válido por 24 horas. O destinatário confirma antes de pagar.</p>
    <label className="block text-sm">Valor em kwanzas<Input inputMode="decimal" value={amount} disabled={busy} onChange={e => setAmount(e.target.value)} /></label>
    <label className="block text-sm">Produto ou serviço<Input maxLength={240} value={description} disabled={busy} onChange={e => setDescription(e.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button disabled={busy} onClick={create}>{busy ? 'A criar…' : 'Criar pedido de teste'}</Button>
  </div>;
}
