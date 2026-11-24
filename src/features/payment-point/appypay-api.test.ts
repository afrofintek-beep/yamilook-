import { beforeEach, expect, it, vi } from 'vitest';
import { appyPayAction, appyPayCapabilities } from './appypay-api';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
const requestId = '33333333-3333-4333-8333-333333333333';
const attempt = {
  id: '44444444-4444-4444-8444-444444444444', request_id: requestId,
  order_id: null, purpose: 'topup', amount_minor: 1250, currency: 'AOA', method: 'GPO', state: 'confirmed',
  created_at: '2026-11-22T09:00:00Z', updated_at: '2026-11-22T09:00:00Z',
};
beforeEach(() => { invoke.mockReset(); });

it('fails closed for absent functions, production capabilities and unsupported methods', async () => {
  invoke.mockResolvedValueOnce({ error: new Error('missing function'), data: null });
  expect((await appyPayCapabilities()).enabled).toBe(false);
  invoke.mockResolvedValueOnce({ data: { enabled: true, environment: 'production', methods: ['GPO'] } });
  expect((await appyPayCapabilities()).enabled).toBe(false);
  invoke.mockResolvedValueOnce({ data: { enabled: true, environment: 'sandbox', methods: ['UNITEL'] } });
  expect((await appyPayCapabilities()).enabled).toBe(false);
});

it('does not expose upstream error details to UI code', async () => {
  invoke.mockResolvedValue({ error: new Error('private provider error'), data: { error: 'private detail' } });
  await expect(appyPayAction({ action: 'status', requestId })).rejects.toThrow('appypay_unavailable');
});

it('rejects a mismatched request or amount instead of accepting its confirmed status', async () => {
  invoke.mockResolvedValueOnce({ data: { attempt: { ...attempt, request_id: '55555555-5555-4555-8555-555555555555' } } });
  await expect(appyPayAction({ action: 'status', requestId })).rejects.toThrow('appypay_invalid_response');
  invoke.mockResolvedValueOnce({ data: { attempt } });
  await expect(appyPayAction({ action: 'create', requestId, amountMinor: 2500, method: 'GPO', phone: '900000000' })).rejects.toThrow('appypay_invalid_response');
});

it('keeps an authoritative missing attempt distinct from a broken response', async () => {
  invoke.mockResolvedValueOnce({ data: { attempt: null } });
  expect(await appyPayAction({ action: 'status', requestId })).toEqual({ attempt: null });
  invoke.mockResolvedValueOnce({ data: {} });
  await expect(appyPayAction({ action: 'status', requestId })).rejects.toThrow('appypay_invalid_response');
});
