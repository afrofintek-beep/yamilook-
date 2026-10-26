import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useCallLifecycle } from './useCallLifecycle';
const m = vi.hoisted(() => ({ rpc: vi.fn(), result: vi.fn(), query: { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: m.rpc, from: () => m.query } }));
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: { id: '00000000-0000-4000-8000-000000000001' } }) }));
vi.mock('@/lib/call-push', () => ({ notifyIncomingCall: vi.fn() }));
const options = { onCallStarted: vi.fn(), onCallEnded: vi.fn(), onCallFailed: vi.fn(), onRingTimeout: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); for (const key of ['update', 'eq', 'select'] as const) m.query[key].mockReturnValue(m.query); });
it('guards direct lifecycle callers before RPC', async () => {
  const { result } = renderHook(() => useCallLifecycle(options));
  await expect(result.current.createCallInDB('00000000-0000-4000-8000-000000000001', 'voice')).rejects.toThrow('própria conta');
  expect(m.rpc).not.toHaveBeenCalled();
});
it.each([{ data: null, error: null }, { data: null, error: { message: 'permission denied' } }])('rejects failed and silently filtered updates', async response => {
  m.query.maybeSingle.mockResolvedValue(response);
  const { result } = renderHook(() => useCallLifecycle(options));
  await expect(result.current.updateParticipantStatus('call', 'user', 'connected')).rejects.toBeTruthy();
  await expect(result.current.updateCallStatus('call', 'ongoing')).rejects.toBeTruthy();
});
it('accepts confirmed updates', async () => {
  m.query.maybeSingle.mockResolvedValue({ data: { id: 'row' }, error: null });
  const { result } = renderHook(() => useCallLifecycle(options));
  await expect(result.current.updateParticipantStatus('call', 'user', 'connected')).resolves.toBeUndefined();
  await expect(result.current.updateCallStatus('call', 'ongoing')).resolves.toBeUndefined();
});
