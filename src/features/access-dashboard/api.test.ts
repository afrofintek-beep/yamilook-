import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessDashboardError, createAccessGroup, featureKeys, loadDashboard, previewAccess, savePolicy, setOverride } from './api';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const policy = {
  feature: 'google_maps' as const, mode: 'selected' as const, enabled: true, startsAt: null, endsAt: null,
  criteria: { role: 'any' as const, groupIds: [], minAccountAgeDays: 0 }, revision: 3, updatedAt: '2026-11-25T15:00:00Z',
};
const dashboard = () => ({
  policies: featureKeys.map(feature => ({ ...policy, feature })), overrides: [], groups: [],
  audit: [{ id: '1', feature: 'google_maps', action: 'policy_saved', actorName: 'Ana', targetName: null,
    createdAt: policy.updatedAt, before: { mode: 'admins' }, after: { mode: 'selected' } }],
});
beforeEach(() => rpc.mockReset());

describe('access dashboard API contract', () => {
  it('retains the saved before/after audit values with a complete feature catalogue', async () => {
    const data = dashboard(); rpc.mockResolvedValue({ data, error: null });
    expect(await loadDashboard()).toEqual(data);
    expect(rpc).toHaveBeenCalledWith('access_dashboard_manage_v2', { p_action: 'dashboard', p_data: {} });
  });

  it('rejects missing or duplicate policies instead of showing an incomplete manager', async () => {
    const data = dashboard(); data.policies[3] = data.policies[0];
    rpc.mockResolvedValue({ data, error: null });
    await expect(loadDashboard()).rejects.toEqual(new AccessDashboardError('unavailable'));
  });

  it('rejects malformed audit snapshots', async () => {
    rpc.mockResolvedValue({ data: { ...dashboard(), audit: [{ ...dashboard().audit[0], after: 'untrusted' }] }, error: null });
    await expect(loadDashboard()).rejects.toEqual(new AccessDashboardError('unavailable'));
  });

  it('never treats a string or missing preview decision as an authorization', async () => {
    const data = featureKeys.map(feature => ({ feature, allowed: true, reason: 'all' }));
    rpc.mockResolvedValue({ data: data.map((decision, index) => index === 0 ? { ...decision, allowed: 'false' } : decision), error: null });
    await expect(previewAccess('ana')).rejects.toEqual(new AccessDashboardError('unavailable'));
    rpc.mockResolvedValue({ data: data.slice(1), error: null });
    await expect(previewAccess('ana')).rejects.toEqual(new AccessDashboardError('unavailable'));
  });

  it('submits the expected revision and only editable policy fields', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    await savePolicy(policy);
    const { updatedAt: _updatedAt, ...payload } = policy;
    expect(rpc).toHaveBeenCalledWith('access_dashboard_manage_v2', { p_action: 'save_policy', p_data: payload });
  });

  it('keeps removing an exception distinct from explicitly blocking a profile', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    await setOverride('maguela', 'ana', 'inherit', null, '');
    expect(rpc).toHaveBeenLastCalledWith('access_dashboard_manage_v2', { p_action: 'set_override', p_data: {
      feature: 'maguela', userId: 'ana', effect: 'inherit', expiresAt: null, note: '',
    } });
  });

  it.each([
    ['40001', 'conflict'], ['42501', 'forbidden'], ['28000', 'forbidden'], ['22023', 'invalid'], ['23505', 'invalid'], ['XX000', 'unavailable'],
  ])('maps SQL failure %s to a safe actionable category', async (code, expected) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: 'Internal server details' } });
    await expect(createAccessGroup('Piloto')).rejects.toEqual(new AccessDashboardError(expected as AccessDashboardError['code']));
  });

  it('requires explicit server success before confirming any change', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(createAccessGroup('Piloto')).rejects.toEqual(new AccessDashboardError('unavailable'));
  });
});
