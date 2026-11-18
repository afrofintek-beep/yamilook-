
export interface PaymentOrder {
  id: string; seller_id: string; buyer_id?: string; seller_name?: string;
  amount: number; description: string; status: string; expires_at: string; own?: boolean;
}
export interface Withdrawal {
  id: string; user_id: string; amount: number; destination: string;
  status: string; evidence?: string; created_at: string;
}
export interface Overview {
  mode: 'sandbox'; country_code: 'AO'; currency: 'AOA'; admin: boolean;
  wallet: { user_id: string; purchased: number; earned: number; reserved: number; merchant: boolean };
  orders: PaymentOrder[]; withdrawals: Withdrawal[];
  entries: { id: number; amount: number; operation: string; reference: string; created_at: string }[];
}
export async function paymentAction<T = { id: string }>(action: string, id?: string, amount?: number, text?: string): Promise<T> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data, error } = await supabase.rpc('payment_point_action' as never, {
    p_action: action, p_id: id ?? null, p_amount: amount ?? null, p_text: text ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return data as T;
}
export function parseAmount(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) throw new Error('Introduza um valor com até duas casas decimais.');
  const amount = Math.round(Number(normalized) * 100);
  if (amount < 1 || amount > 100000000) throw new Error('O limite por operação de teste é 1.000.000 Kz.');
  return amount;
}
export const money = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value / 100);
export const orderLink = (id: string) => `${window.location.origin}/payment-point/${id}`;
export function parseOrderLink(value: string): string {
  const url = new URL(value);
  if (url.origin !== window.location.origin) throw new Error('Este QR não pertence à Yamilook.');
  const match = url.pathname.match(/^\/payment-point\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
  if (!match) throw new Error('QR de pagamento inválido.');
  return match[1];
}
