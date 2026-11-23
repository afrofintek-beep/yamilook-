import { useReceiveLabels } from './receive-labels';
import { WalletAccessGate } from './WalletAccess';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { money, paymentAction, type PaymentOrder, parseOrderLink } from './api';

export function paymentIdFromMessage(content: string | null): string | null {
  if (!content?.startsWith('Pedido de pagamento · TESTE\n')) return null;
  const link = content.split('\n').at(-1)?.replace(/^Pagar pedido: /, '');
  try { return link ? parseOrderLink(link) : null; } catch { return null; }
}
export function PaymentMessage({ id }: { id: string; content: string }) {
  return <WalletAccessGate silent><OrderCard id={id} /></WalletAccessGate>;
}
function OrderCard({ id }: { id: string }) {
  const copy = useReceiveLabels();
  const { user } = useAuth();
  const { data: order } = useQuery({
    queryKey: ['payment-message', user?.id, id],
    queryFn: () => paymentAction<PaymentOrder>('view', id),
    refetchInterval: query => query.state.data?.status === 'pending' &&
      Date.parse(query.state.data.expires_at) > Date.now() ? 30000 : false,
  });
  const paid = order?.status === 'paid';
  return <div className="space-y-2 py-1">
    <p className="text-sm font-medium">{copy.testRequest}</p>
    {order && <>
      <p>{order.seller_name || 'Carteira …' + order.seller_id.slice(-6)} · {money(order.amount)}</p>
      <p className="break-words text-xs">Motivo: {order.description}</p>
      {paid && <p role="status">Pago em teste</p>}
    </>}
    <Link className="inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" to={`/payment-point/${id}`}>{paid ? 'Ver comprovativo' : copy.view}</Link>
  </div>;
}
