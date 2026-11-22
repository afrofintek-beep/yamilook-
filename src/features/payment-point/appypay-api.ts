export type AppyPayMethod = 'GPO' | 'REF';
export type AppyPayState = 'submitting' | 'pending' | 'uncertain' | 'confirmed' | 'failed' | 'expired' | 'review';
export interface AppyPayAttempt {
  id: string;
  request_id: string;
  order_id: string | null;
  purpose: 'order' | 'topup';
  amount_minor: number;
  currency: 'AOA';
  method: AppyPayMethod;
  state: AppyPayState;
  provider_charge_id?: string | null;
  entity?: string | null;
  reference?: string | null;
  provider_due_at?: string | null;
  issue_code?: string | null;
  created_at: string;
  updated_at: string;
}
export interface AppyPayCapabilities {
  enabled: boolean;
  environment: 'sandbox';
  methods: AppyPayMethod[];
}
export interface AppyPayRequest {
  requestId: string;
  orderId?: string;
  amountMinor?: number;
  method: AppyPayMethod;
  phone?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES: AppyPayState[] = ['submitting', 'pending', 'uncertain', 'confirmed', 'failed', 'expired', 'review'];
export const APPYPAY_TEST_PHONES = ['900000000', '900000001', '900000002', '900000003'] as const;
const disabled: AppyPayCapabilities = { enabled: false, environment: 'sandbox', methods: [] };

// Provider payloads and upstream errors never become UI copy.
async function invoke(body: Record<string, unknown>): Promise<unknown> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data, error } = await supabase.functions.invoke('massa-appypay', { body });
  if (error || !data || data.error) throw new Error('appypay_unavailable');
  return data;
}

/** An absent or disabled endpoint does not interrupt the existing wallet pilot. */
export async function appyPayCapabilities(): Promise<AppyPayCapabilities> {
  try {
    const data = await invoke({ action: 'capabilities' }) as Partial<AppyPayCapabilities>;
    if (data.enabled !== true || data.environment !== 'sandbox' || !Array.isArray(data.methods)) return disabled;
    const methods = [...new Set(data.methods.filter(method => method === 'GPO' || method === 'REF'))];
    return { enabled: methods.length > 0, environment: 'sandbox', methods };
  } catch { return disabled; }
}

function isAttempt(value: unknown): value is AppyPayAttempt {
  if (!value || typeof value !== 'object') return false;
  const a = value as AppyPayAttempt;
  return UUID.test(a.id) && UUID.test(a.request_id)
    && (a.order_id == null || UUID.test(a.order_id))
    && (a.purpose === 'order' || a.purpose === 'topup')
    && Number.isSafeInteger(a.amount_minor) && a.amount_minor > 0 && a.currency === 'AOA'
    && (a.method === 'GPO' || a.method === 'REF') && STATES.includes(a.state)
    && [a.entity, a.reference, a.provider_due_at].every(item => item == null || typeof item === 'string');
}

export async function appyPayAction(input: ({ action: 'create' } & AppyPayRequest) | {
  action: 'status'; requestId?: string; orderId?: string; attemptId?: string;
}): Promise<{ attempt: AppyPayAttempt | null; reused?: boolean }> {
  const result = await invoke({ ...input }) as { attempt?: unknown; reused?: boolean };
  if (result.attempt === null && input.action === 'status') return { attempt: null };
  if (!isAttempt(result.attempt)) throw new Error('appypay_invalid_response');
  // Do not accept a response for a different order or request as confirmation.
  if (input.orderId && result.attempt.order_id !== input.orderId) throw new Error('appypay_invalid_response');
  if (input.requestId && result.attempt.request_id !== input.requestId) throw new Error('appypay_invalid_response');
  if (input.action === 'status' && input.attemptId && result.attempt.id !== input.attemptId) throw new Error('appypay_invalid_response');
  if (input.action === 'create' && (result.attempt.purpose !== (input.orderId ? 'order' : 'topup')
    || (!input.orderId && result.attempt.amount_minor !== input.amountMinor))) throw new Error('appypay_invalid_response');
  return { attempt: result.attempt, reused: result.reused };
}

export function appyPayStorageKey(userId: string, orderId?: string): string {
  return `massa-appypay:v1:${userId}:${orderId ? `order:${orderId}` : 'topup'}`;
}
export function readAppyPayRequest(key: string): AppyPayRequest | null {
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null') as AppyPayRequest | null;
    if (!data || !UUID.test(data.requestId) || !['GPO', 'REF'].includes(data.method)) return null;
    if (data.orderId ? !UUID.test(data.orderId) : !Number.isSafeInteger(data.amountMinor) || data.amountMinor! <= 0) return null;
    if (data.method === 'GPO' && !APPYPAY_TEST_PHONES.includes(data.phone as typeof APPYPAY_TEST_PHONES[number])) return null;
    return data;
  } catch { return null; }
}
export function saveAppyPayRequest(key: string, request: AppyPayRequest): void {
  // Persist before sending, so a reload can recover an unknown transport outcome.
  localStorage.setItem(key, JSON.stringify(request));
}
export function clearAppyPayRequest(key: string): void { localStorage.removeItem(key); }
export const appyPayIsTerminal = (state: AppyPayState) => ['confirmed', 'failed', 'expired'].includes(state);
