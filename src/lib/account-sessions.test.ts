import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deviceDescriptor, accountRpc, revokeAccountSession, listAccountSessions, acknowledgeLoginAlerts } from './account-sessions';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

beforeEach(() => { rpc.mockReset(); });

describe('account session RPC contract', () => {
  it('marks each YAMILOOK and KOSOLOLA surface independently', () => {
    expect(deviceDescriptor('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile Safari/604.1', '/papos-app/').p_surface).toBe('kosolola');
    expect(deviceDescriptor('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0', '/settings').p_surface).toBe('yamilook');
  });
  it('does not silently accept backend authorization errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Not authorized' } });
    await expect(revokeAccountSession('target')).rejects.toThrow('Not authorized');
  });
  it('requests precisely one target for revocation (never bulk logout)', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await revokeAccountSession('target');
    expect(rpc).toHaveBeenCalledWith('account_revoke_session', { p_session_id: 'target' });
  });
  it('returns backend-owned list without client-side session guessing', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'session-a', is_current: true }], error: null });
    expect(await listAccountSessions()).toEqual([{ id: 'session-a', is_current: true }]);
    expect(rpc).toHaveBeenCalledWith('account_list_sessions', undefined);
  });
  it('never submits an empty acknowledgement', async () => {
    await acknowledgeLoginAlerts([]);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('surfaces database errors to callers', async () => {
    rpc.mockRejectedValue(new Error('offline'));
    await expect(accountRpc('account_list_sessions')).rejects.toThrow('offline');
  });
});

describe('remote revocation classification', () => {
  it('detects server-revoked JWT sessions', async () => {
    const { isRevokedSessionError } = await import('./account-sessions');
    expect(isRevokedSessionError({ code: '28000', status: 401 })).toBe(true);
    expect(isRevokedSessionError({ code: 'PGRST301' })).toBe(false);
  });
  it('does not sign out for offline, permissions, or absent migrations', async () => {
    const { isRevokedSessionError } = await import('./account-sessions');
    expect(isRevokedSessionError({ code: 'PGRST202', status: 404 })).toBe(false);
    expect(isRevokedSessionError({ code: '42501', status: 403 })).toBe(false);
    expect(isRevokedSessionError(undefined)).toBe(false);
  });
});
