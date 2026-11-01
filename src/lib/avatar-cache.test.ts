import { Blob as NodeBlob } from 'node:buffer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cacheableAvatar, clearAvatarCache, readAvatar, rememberAvatar } from './avatar-cache';
const origin = 'https://project.supabase.co';
const src = origin + '/storage/v1/object/public/avatars/person/a.jpg';
let entries: Map<string, Response>;
let put: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubEnv('VITE_SUPABASE_URL', origin);
  entries = new Map();
  put = vi.fn(async (url: string, response: Response) => { entries.set(url, response); });
  vi.stubGlobal('caches', { open: vi.fn(async () => ({
    match: async (url: string) => entries.get(url)?.clone(), put,
    keys: async () => [...entries.keys()], delete: async (key: string) => entries.delete(key),
  })), delete: vi.fn(async () => { entries.clear(); return true; }) });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('photo', { headers: { 'content-type': 'image/jpeg' } })));
  clearAvatarCache();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it.each([
 origin + '/storage/v1/object/sign/avatars/a?token=x',
 origin + '/storage/v1/object/public/chat-attachments/a.jpg',
 src + '?token=x', 'https://other.test/storage/v1/object/public/avatars/a.jpg',
 'blob:https://example.test/photo',
])('never stores private, external or signed media: %s', async url => {
 expect(cacheableAvatar(url)).toBe(false); await rememberAvatar(url); expect(fetch).not.toHaveBeenCalled();
});
it('stores a public photo and returns its bytes while offline', async () => {
 await rememberAvatar(src);
 vi.mocked(fetch).mockRejectedValue(new Error('offline'));
 expect(await (await readAvatar(src))?.text()).toBe('photo');
 await rememberAvatar(src); expect(fetch).toHaveBeenCalledTimes(1);
});
it('deduplicates simultaneous writes', async () => {
 await Promise.all([rememberAvatar(src),rememberAvatar(src)]);
 expect(fetch).toHaveBeenCalledTimes(1);
});
it('expires old photos', async () => {
 await rememberAvatar(src); vi.spyOn(Date,'now').mockReturnValue(Date.now()+86400001);
 expect(await readAvatar(src)).toBeUndefined();
});
it('clears photos on logout and rejects a late download', async () => {
 let resolve!: (response: Response) => void;
 vi.mocked(fetch).mockImplementation(() => new Promise(r => {resolve=r;}));
 const work=rememberAvatar(src);
 await vi.waitFor(()=>expect(fetch).toHaveBeenCalled());
 clearAvatarCache(); resolve(new Response('late',{headers:{'content-type':'image/jpeg'}})); await work;
 expect(put).not.toHaveBeenCalled(); expect(await readAvatar(src)).toBeUndefined();
});
it('does not cache HTML errors or oversized photos',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce(new Response('error',{headers:{'content-type':'text/html'}}));
 await rememberAvatar(src); expect(put).not.toHaveBeenCalled();
 vi.mocked(fetch).mockResolvedValueOnce(new Response(new Uint8Array(2097153),{headers:{'content-type':'image/jpeg'}}));
 await rememberAvatar(src); expect(put).not.toHaveBeenCalled();
});
it('tolerates storage quota errors',async()=>{
 put.mockRejectedValue(new Error('quota'));
 await expect(rememberAvatar(src)).resolves.toBeUndefined();
});
it('limits stored images', async()=>{
 for(let i=0;i<42;i++)await rememberAvatar(src.replace('a.jpg',`${i}.jpg`));
 expect(entries.size).toBe(40);
});
