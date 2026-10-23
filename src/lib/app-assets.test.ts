import { afterEach, describe, expect, it, vi } from 'vitest';
import { recoverApplicationAssets } from './app-assets';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('independent application recovery', () => {
  it.each(['/', '/papos-app/'] as const)('repairs %s without deleting the other application or private caches', async scope => {
    const root={scope:new URL('/',location.origin).href,unregister:vi.fn()}; const papos={scope:new URL('/papos-app/',location.origin).href,unregister:vi.fn()};
    Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistrations:async()=>[root,papos]}});
    const remove=vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches',{keys:async()=>['workbox-precache-main','yamilook-post-images-v1','papos-app-assets-v1','private-drafts'],delete:remove});
    await recoverApplicationAssets(scope);
    expect(scope==='/'?root.unregister:papos.unregister).toHaveBeenCalledOnce();
    expect(scope==='/'?papos.unregister:root.unregister).not.toHaveBeenCalled();
    expect(remove.mock.calls.map(([name])=>name)).toEqual(scope==='/'?['workbox-precache-main','yamilook-post-images-v1']:['papos-app-assets-v1']);
  });
});
