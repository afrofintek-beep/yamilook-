import { useReceiveLabels } from '@/features/payment-point/receive-labels';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { paymentAction, parseAmount, orderLink, money } from './api';

export function RequestPayment({ onCreated, chat = false, business = false }: { chat?: boolean; business?: boolean; onCreated: (id: string, message: string) => Promise<void> }) {
  const copy = useReceiveLabels();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ id: string; amount: number; description: string } | null>(null);
  async function create() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      let cents: number;
      try { cents = parseAmount(amount); } catch { setError(copy.invalid); return; }
      const reason = description.trim() || copy.request;
      if (business && !description.trim()) { setError(copy.product); return; }
      if (!pending.current || pending.current.amount !== cents || pending.current.description !== reason) {
        pending.current = { id: crypto.randomUUID(), amount: cents, description: reason };
      }
      const request = pending.current;
      await paymentAction('merchant');
      await paymentAction('create', request.id, cents, reason);
      await onCreated(request.id, `Pedido de pagamento · TESTE\n${reason}\n${money(cents)}\nPagar pedido: ${orderLink(request.id)}`);
      pending.current = null; setAmount(''); setDescription('');
    } catch { setError(copy.error); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{copy.note}</p>
    <label className="block text-sm">{copy.amount}<Input inputMode="decimal" value={amount} disabled={busy} onChange={e => setAmount(e.target.value)} /></label>
    <label className="block text-sm">{business ? copy.product : copy.reason}<Input maxLength={240} value={description} disabled={busy} onChange={e => setDescription(e.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button disabled={busy} onClick={create}>{busy ? copy.creating : chat ? copy.send : copy.generate}</Button>
  </div>;
}
