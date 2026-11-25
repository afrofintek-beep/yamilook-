export type UnitelState = 'submitting' | 'pending' | 'uncertain' | 'confirmed' | 'failed' | 'expired' | 'review';

export interface UnitelAttempt {
  id: string;
  request_id: string;
  order_id: string;
  amount_minor: number;
  currency: 'AOA';
  method: 'UNITEL_MONEY';
  purpose: 'order';
  state: UnitelState;
  provider_transaction_id?: string | null;
  issue_code?: string | null;
  created_at: string;
  updated_at: string;
}
export interface UnitelCapabilities {
  enabled: boolean;
  environment: 'sandbox';
  methods: 'UNITEL_MONEY'[];
  testPhones?: string[];
}
export interface UnitelRequest { requestId: string; orderId: string; phone: string }
export type UnitelStatusRequest = { action: 'status' } & (
  { attemptId: string; orderId?: never; requestId?: never }
  | { orderId: string; attemptId?: never; requestId?: never }
  | { requestId: string; attemptId?: never; orderId?: never }
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE = /^\+?\d{9,15}$/;
const STATES: UnitelState[] = ['submitting', 'pending', 'uncertain', 'confirmed', 'failed', 'expired', 'review'];
const disabled: UnitelCapabilities = { enabled: false, environment: 'sandbox', methods: [], testPhones: [] };

async function invoke(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data, error } = await supabase.functions.invoke('massa-unitel', { body });
  if (error || !data || typeof data !== 'object' || Array.isArray(data) || data.error) {
    throw new Error('unitel_unavailable');
  }
  return data;
}

export async function unitelCapabilities(): Promise<UnitelCapabilities> {
  try {
    const result = await invoke({ action: 'capabilities' });
    if (result.enabled !== true || result.environment !== 'sandbox'
      || !Array.isArray(result.methods) || !result.methods.includes('UNITEL_MONEY')) return disabled;
    const testPhones = Array.isArray(result.testPhones)
      ? [...new Set(result.testPhones.filter((phone): phone is string => typeof phone === 'string' && PHONE.test(phone)))] : [];
    return { enabled: true, environment: 'sandbox', methods: ['UNITEL_MONEY'], testPhones };
  } catch { return disabled; }
}

function isAttempt(value: unknown): value is UnitelAttempt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as UnitelAttempt;
  return [item.id, item.request_id, item.order_id].every(id => typeof id === 'string' && UUID.test(id))
    && Number.isSafeInteger(item.amount_minor) && item.amount_minor > 0 && item.currency === 'AOA'
    && item.method === 'UNITEL_MONEY' && item.purpose === 'order'
    && STATES.includes(item.state)
    && [item.created_at, item.updated_at].every(date => typeof date === 'string' && Number.isFinite(Date.parse(date)))
    && [item.provider_transaction_id, item.issue_code].every(field => field == null || typeof field === 'string');
}

/** Local context is checked without ever sending a client-supplied amount to the gateway. */
export function matchesUnitelAttempt(value: unknown, expected: {
  orderId: string; amountMinor: number; requestId?: string; attemptId?: string;
}): value is UnitelAttempt {
  return isAttempt(value) && value.order_id === expected.orderId && value.amount_minor === expected.amountMinor
    && (!expected.requestId || value.request_id === expected.requestId)
    && (!expected.attemptId || value.id === expected.attemptId);
}

export async function unitelAction(input: ({ action: 'create' } & UnitelRequest) | UnitelStatusRequest): Promise<{
  attempt: UnitelAttempt | null; reused?: boolean;
}> {
  let body: Record<string, unknown>;
  if (input.action === 'create') {
    if (!UUID.test(input.requestId) || !UUID.test(input.orderId) || !PHONE.test(input.phone)) {
      throw new Error('unitel_invalid_request');
    }
    // Whitelist fields: amounts, beneficiaries and environment cannot be supplied by a browser.
    body = { action: 'create', requestId: input.requestId, orderId: input.orderId, phone: input.phone };
  } else if (input.action === 'status') {
    const locators = ['attemptId', 'orderId', 'requestId'].filter(key => input[key as keyof UnitelStatusRequest] !== undefined);
    if (locators.length !== 1) throw new Error('unitel_invalid_request');
    const key = locators[0] as 'attemptId' | 'orderId' | 'requestId';
    if (!UUID.test(input[key] || '')) throw new Error('unitel_invalid_request');
    body = { action: 'status', [key]: input[key] };
  } else throw new Error('unitel_invalid_request');
  const result = await invoke(body);
  if (result.environment !== undefined && result.environment !== 'sandbox') throw new Error('unitel_invalid_response');
  if (result.attempt === null && input.action === 'status') return { attempt: null };
  const attempt = result.attempt;
  if (!isAttempt(attempt)
    || (input.orderId && attempt.order_id !== input.orderId)
    || (input.requestId && attempt.request_id !== input.requestId)
    || (input.action === 'status' && input.attemptId && attempt.id !== input.attemptId)) {
    throw new Error('unitel_invalid_response');
  }
  return { attempt: {
    id: attempt.id, request_id: attempt.request_id, order_id: attempt.order_id,
    amount_minor: attempt.amount_minor, currency: attempt.currency, state: attempt.state,
    method: attempt.method, purpose: attempt.purpose,
    provider_transaction_id: attempt.provider_transaction_id, issue_code: attempt.issue_code,
    created_at: attempt.created_at, updated_at: attempt.updated_at,
  }, reused: result.reused === true };
}

export function unitelStorageKey(userId: string, orderId: string) { return `massa-unitel:v1:${userId}:order:${orderId}`; }
export function readUnitelRequest(key: string): UnitelRequest | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (!value || typeof value.requestId !== 'string' || !UUID.test(value.requestId)
      || typeof value.orderId !== 'string' || !UUID.test(value.orderId)
      || typeof value.phone !== 'string' || !PHONE.test(value.phone)) return null;
    return { requestId: value.requestId, orderId: value.orderId, phone: value.phone };
  } catch { return null; }
}
export function saveUnitelRequest(key: string, request: UnitelRequest) {
  localStorage.setItem(key, JSON.stringify({ requestId: request.requestId, orderId: request.orderId, phone: request.phone }));
}
export function clearUnitelRequest(key: string) { localStorage.removeItem(key); }
export const unitelIsTerminal = (state: UnitelState) => ['confirmed', 'failed', 'expired'].includes(state);
