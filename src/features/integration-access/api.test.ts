import { beforeEach, expect, it, vi } from 'vitest';
import { getIntegrationAccess } from './api';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const access = { userId: 'ana', admin: false, googleMaps: false, maguela: true, wallet: false, businessRegistration: true };
beforeEach(() => rpc.mockReset());

it('accepts only server booleans for all four current-account decisions', async () => {
  rpc.mockResolvedValue({ data: access, error: null });
  expect(await getIntegrationAccess()).toEqual(access);
  rpc.mockResolvedValue({ data: { ...access, wallet: 'true' }, error: null });
  await expect(getIntegrationAccess()).rejects.toThrow('integration_access_unavailable');
});

it('fails closed until the complete dashboard migration is available', async () => {
  const { wallet: _wallet, businessRegistration: _businessRegistration, ...oldStatus } = access;
  rpc.mockResolvedValue({ data: oldStatus, error: null });
  await expect(getIntegrationAccess()).rejects.toThrow('integration_access_unavailable');
});

it('forwards cancellation to the RPC and fails closed on server errors', async () => {
  const controller = new AbortController();
  const abortSignal = vi.fn().mockResolvedValue({ data: access, error: null });
  rpc.mockReturnValue({ abortSignal });
  expect(await getIntegrationAccess(controller.signal)).toEqual(access);
  expect(abortSignal).toHaveBeenCalledWith(controller.signal);
  abortSignal.mockResolvedValue({ data: access, error: { code: '42501' } });
  await expect(getIntegrationAccess(controller.signal)).rejects.toThrow('integration_access_unavailable');
});
