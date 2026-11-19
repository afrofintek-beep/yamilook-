import { WalletAccessGate } from './WalletAccess';
import { Link } from 'react-router-dom';
import { parseOrderLink } from './api';

export function paymentIdFromMessage(content: string | null): string | null {
  if (!content?.startsWith('Pedido de pagamento · TESTE\n')) return null;
  const link = content.split('\n').at(-1)?.replace(/^Pagar pedido: /, '');
  try { return link ? parseOrderLink(link) : null; } catch { return null; }
}
export function PaymentMessage({ id }: { id: string }) {
  return <WalletAccessGate silent><div className="space-y-2 py-1">
    <p className="text-sm font-medium">Pedido de pagamento · Angola · Teste</p>
    <p className="text-xs">Consulte o destinatário, o valor e o estado antes de confirmar.</p>
    <Link className="inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" to={`/payment-point/${id}`}>Ver pedido</Link>
  </div></WalletAccessGate>;
}
