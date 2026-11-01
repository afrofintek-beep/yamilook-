import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCachedAvatar } from './useCachedAvatar';
const mocks=vi.hoisted(()=>({read:vi.fn(),remember:vi.fn()}));
vi.mock('@/lib/avatar-cache',()=>({readAvatar:mocks.read,rememberAvatar:mocks.remember}));
beforeEach(()=>{
 mocks.read.mockReset().mockResolvedValue(undefined);mocks.remember.mockReset();
 URL.createObjectURL=vi.fn().mockReturnValue('blob:cached');URL.revokeObjectURL=vi.fn();
});
afterEach(cleanup);
it('uses saved bytes and releases the object URL when the avatar unmounts',async()=>{
 mocks.read.mockResolvedValue(new Blob(['photo']));
 const h=renderHook(()=>useCachedAvatar('https://avatar/a'));
 await waitFor(()=>expect(h.result.current.src).toBe('blob:cached'));
 h.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cached');
});
it('does not display a previous persons photo while a new lookup is pending',async()=>{
 mocks.read.mockResolvedValueOnce(new Blob(['a'])).mockImplementation(()=>new Promise(()=>{}));
 const h=renderHook(({src})=>useCachedAvatar(src),{initialProps:{src:'a'}});
 await waitFor(()=>expect(h.result.current.src).toBe('blob:cached'));
 h.rerender({src:'b'});expect(h.result.current.src).toBe('b');
 h.rerender({src:'a'});expect(h.result.current.src).toBe('a');
});
it('retries on restored connectivity without changing the server URL',()=>{
 const h=renderHook(()=>useCachedAvatar('a'));
 act(()=>window.dispatchEvent(new Event('online')));
 expect(h.result.current.retry).toBe(1);expect(h.result.current.src).toBe('a');
 act(()=>h.result.current.loaded());expect(mocks.remember).toHaveBeenCalledWith('a');
});
