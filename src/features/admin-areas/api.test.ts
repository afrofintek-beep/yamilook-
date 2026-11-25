import { beforeEach, expect, it, vi } from 'vitest';
import { getAdminAreaAccess } from './api';
import { adminAreaKeys } from './catalog';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
beforeEach(() => rpc.mockReset());
it('requires all area decisions to be explicit booleans', async () => {
  const areas = Object.fromEntries(adminAreaKeys.map(key => [key, false]));
  rpc.mockResolvedValue({ data: { userId: 'operator', admin: false, areas }, error: null });
  expect((await getAdminAreaAccess()).areas.admin_payouts).toBe(false);
  delete areas.admin_payouts;
  await expect(getAdminAreaAccess()).rejects.toThrow('admin_area_access_unavailable');
  rpc.mockResolvedValue({ data: { userId: 'operator', admin: false, areas: { ...areas, admin_payouts: 'true' } }, error: null });
  await expect(getAdminAreaAccess()).rejects.toThrow('admin_area_access_unavailable');
});
it('rejects server errors even when stale data accompanies them', async () => {
  rpc.mockResolvedValue({ data: { userId: 'operator', admin: true, areas: Object.fromEntries(adminAreaKeys.map(key => [key,true])) }, error: { message: 'revoked session' } });
  await expect(getAdminAreaAccess()).rejects.toThrow('admin_area_access_unavailable');
});
