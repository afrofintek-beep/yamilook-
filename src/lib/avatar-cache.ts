/** Cache only this project's public avatar bucket, never signed/private media. */
const CACHE = 'kosolola-public-avatars-v1';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 40;
const MAX_AGE = 24 * 60 * 60 * 1000;
let epoch = 0;
const pending = new Map<string, Promise<void>>();
export function cacheableAvatar(src: string | undefined, projectUrl = import.meta.env.VITE_SUPABASE_URL): boolean {
  try {
    const url = new URL(src || '');
    return url.protocol === 'https:' && url.origin === new URL(projectUrl).origin
      && url.pathname.startsWith('/storage/v1/object/public/avatars/') && !url.search && !url.hash;
  } catch { return false; }
}
export async function readAvatar(src: string): Promise<Blob | undefined> {
  if (!cacheableAvatar(src) || typeof caches === 'undefined') return;
  const version = epoch;
  try {
    const cache = await caches.open(CACHE);
    const response = await cache.match(src);
    if (!response) return;
    const storedAt = Number(response.headers.get('x-avatar-cached-at'));
    if (!storedAt || Date.now() - storedAt > MAX_AGE) { await cache.delete(src); return; }
    const blob = await response.blob();
    if (version === epoch && blob.size <= MAX_BYTES && blob.type.startsWith('image/')) return blob;
  } catch { /* Browser HTTP cache and original URL remain usable. */ }
}
export function rememberAvatar(src: string): Promise<void> {
  if (!cacheableAvatar(src) || typeof caches === 'undefined') return Promise.resolve();
  const existing = pending.get(src);
  if (existing) return existing;
  const version = epoch;
  const task = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      if (await readAvatar(src)) return;
      const response = await fetch(src, { credentials: 'omit', signal: controller.signal });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')
        || Number(response.headers.get('content-length')) > MAX_BYTES) return;
      const blob = await response.blob();
      if (version !== epoch || blob.size > MAX_BYTES) return;
      const cache = await caches.open(CACHE);
      if (version !== epoch) return;
      await cache.put(src, new Response(blob, { headers: {
        'content-type': blob.type, 'x-avatar-cached-at': String(Date.now()),
      } }));
      if (version !== epoch) { await cache.delete(src); return; }
      const keys = await cache.keys();
      for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(key);
    } catch { /* CORS, offline and quota failures must not hide the original image. */ }
    finally { clearTimeout(timer); }
  })();
  pending.set(src, task);
  void task.finally(() => { if (pending.get(src) === task) pending.delete(src); });
  return task;
}
export function clearAvatarCache() {
  ++epoch;
  pending.clear();
  if (typeof caches !== 'undefined') void caches.delete(CACHE).catch(() => {});
}
