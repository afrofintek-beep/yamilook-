import { useReceiveLabels } from './receive-labels';
import { WalletAccessGate } from './WalletAccess';
import { Link } from 'react-router-dom';
import { parseOrderLink } from './api';

export function paymentIdFromMessage(content: string | null): string | null {
  if (!content?.startsWith('Pedido de pagamento · TESTE\n')) return null;
  const link = content.split('\n').at(-1)?.replace(/^Pagar pedido: /, '');
  try { return link ? parseOrderLink(link) : null; } catch { return null; }
}
export function PaymentMessage({ id, content }: { id: string; content: string }) {
  const copy = useReceiveLabels();
  const lines = content.split('\n');
  return <WalletAccessGate silent><div className="space-y-2 py-1">
    <p className="text-sm font-medium">{copy.testRequest}</p>
    <p className="text-xs">{lines.slice(1, -2).join(' ')} · {lines.at(-2)}</p>
    <Link className="inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" to={`/payment-point/${id}`}>{copy.view}</Link>
  </div></WalletAccessGate>;
}
