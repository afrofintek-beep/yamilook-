import { beforeEach, expect, it, vi } from 'vitest';
import { matchesUnitelAttempt, readUnitelRequest, unitelAction, unitelCapabilities, unitelStorageKey, type UnitelAttempt } from './unitel-api';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
const requestId = '33333333-3333-4333-8333-333333333333';
const orderId = '22222222-2222-4222-8222-222222222222';
const otherId = '55555555-5555-4555-8555-555555555555';
const phone = '+244900000021';
const attempt: UnitelAttempt = {
  id: '44444444-4444-4444-8444-444444444444', request_id: requestId, order_id: orderId,
  amount_minor: 1250, currency: 'AOA', method: 'UNITEL_MONEY', purpose: 'order', state: 'confirmed',
  created_at: '2026-11-25T09:00:00Z', updated_at: '2026-11-25T09:00:00Z',
};
beforeEach(() => { invoke.mockReset(); vi.mocked(localStorage.getItem).mockReset(); });

it('hides absent, disabled, production and unsupported capabilities', async () => {
  for (const data of [null, { enabled: false }, { enabled: true, environment: 'production', methods: ['UNITEL_MONEY'] },
    { enabled: true, environment: 'sandbox', methods: ['GPO'] }]) {
    invoke.mockResolvedValueOnce({ data });
    expect((await unitelCapabilities()).enabled).toBe(false);
  }
});

it('preserves approved test phone formatting and supplies no fallback phone list', async () => {
  invoke.mockResolvedValueOnce({ data: { enabled: true, environment: 'sandbox', methods: ['UNITEL_MONEY'], testPhones: [phone, phone, 'unsafe', 123] } });
  expect(await unitelCapabilities()).toEqual({ enabled: true, environment: 'sandbox', methods: ['UNITEL_MONEY'], testPhones: [phone] });
  invoke.mockResolvedValueOnce({ data: { enabled: true, environment: 'sandbox', methods: ['UNITEL_MONEY'] } });
  expect((await unitelCapabilities()).testPhones).toEqual([]);
});

it('sends only the order reference and test phone through the shared Supabase function', async () => {
  invoke.mockResolvedValue({ data: { attempt: { ...attempt, payer_phone: phone, secret: 'private' } } });
  const input = { action: 'create' as const, requestId, orderId, phone, amountMinor: 999, beneficiary: otherId, environment: 'production' };
  const result = await unitelAction(input);
  expect(invoke).toHaveBeenCalledWith('massa-unitel', { body: { action: 'create', requestId, orderId, phone } });
  expect(result.attempt).not.toHaveProperty('payer_phone');
  expect(result.attempt).not.toHaveProperty('secret');
});

it('requires exactly one valid status locator', async () => {
  // Exercise runtime callers that do not have TypeScript checking.
  await expect(unitelAction({ action: 'status', requestId, orderId } as never)).rejects.toThrow('unitel_invalid_request');
  await expect(unitelAction({ action: 'status' } as never)).rejects.toThrow('unitel_invalid_request');
  await expect(unitelAction({ action: 'status', requestId: 'not-a-uuid' })).rejects.toThrow('unitel_invalid_request');
  expect(invoke).not.toHaveBeenCalled();
});

it.each([
  { request_id: otherId }, { order_id: otherId }, { purpose: 'topup' }, { method: 'GPO' },
  { currency: 'USD' }, { amount_minor: 1.5 }, { state: 'success' }, { created_at: 'invalid' },
])('rejects a mismatched or malformed confirmed response: %j', async changes => {
  invoke.mockResolvedValue({ data: { attempt: { ...attempt, ...changes } } });
  await expect(unitelAction({ action: 'create', requestId, orderId, phone })).rejects.toThrow('unitel_invalid_response');
});

it('validates the receipt amount and request against local order context without sending the amount', () => {
  expect(matchesUnitelAttempt(attempt, { orderId, amountMinor: 1250, requestId })).toBe(true);
  expect(matchesUnitelAttempt(attempt, { orderId, amountMinor: 2500, requestId })).toBe(false);
  expect(matchesUnitelAttempt(attempt, { orderId, amountMinor: 1250, attemptId: otherId })).toBe(false);
});

it('keeps an authoritative miss distinct from a broken response or private upstream error', async () => {
  invoke.mockResolvedValueOnce({ data: { attempt: null } });
  expect(await unitelAction({ action: 'status', requestId })).toEqual({ attempt: null });
  invoke.mockResolvedValueOnce({ data: {} });
  await expect(unitelAction({ action: 'status', requestId })).rejects.toThrow('unitel_invalid_response');
  invoke.mockResolvedValueOnce({ error: new Error('provider credential'), data: { error: { message: 'private' } } });
  await expect(unitelAction({ action: 'status', requestId })).rejects.toThrow('unitel_unavailable');
});

it('namespaces recovery by account and order and drops extra stored payload fields', () => {
  expect(unitelStorageKey('account-a', orderId)).not.toBe(unitelStorageKey('account-b', orderId));
  expect(unitelStorageKey('account-a', orderId)).not.toBe(unitelStorageKey('account-a', otherId));
  vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ requestId, orderId, phone, amountMinor: 2500 }));
  expect(readUnitelRequest('key')).toEqual({ requestId, orderId, phone });
  vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ requestId, phone }));
  expect(readUnitelRequest('key')).toBeNull();
});
