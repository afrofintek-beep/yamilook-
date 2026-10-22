import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLegacyPrivateCache } from './private-cache';
afterEach(() => vi.unstubAllGlobals());
describe('legacy private response cache', () => {
  it('removes only the legacy API cache', async () => {
    const remove = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', { delete: remove });
    await clearLegacyPrivateCache();
    expect(remove).toHaveBeenCalledExactlyOnceWith('supabase-api');
  });
  it('does not prevent sign-out when cache storage is unavailable', async () => {
    vi.stubGlobal('caches', { delete: vi.fn().mockRejectedValue(new Error('denied')) });
    await expect(clearLegacyPrivateCache()).resolves.toBeUndefined();
  });
});
