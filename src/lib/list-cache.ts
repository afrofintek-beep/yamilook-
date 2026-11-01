/** Bounded UI snapshots only. Server authorization remains mandatory for actions. */
const PREFIX = 'kosolola:list:v1:';
const MAX_AGE = 60 * 60 * 1000;
const memory = new Map<string, { expires: number; items: unknown[] }>();
let epoch = 0;
export const listCacheEpoch = () => epoch;
export const listCacheKey = (userId: string, list: string) => `${PREFIX}${userId}:${list}`;

// Do not retain message bodies, attachment URLs, or cached online indicators.
function snapshot(items: unknown[]): unknown[] {
  return JSON.parse(JSON.stringify(items.slice(0, 100), (key, value) => {
    if (key === 'last_message') return undefined;
    if (key === 'is_online') return false;
    return value;
  }));
}
export function readListCache<T>(key: string): T[] | undefined {
  try {
    const entry = memory.get(key) ?? JSON.parse(localStorage.getItem(key) || 'null');
    if (!entry || !Number.isFinite(entry.expires) || entry.expires <= Date.now() ||
        !Array.isArray(entry.items) || entry.items.length > 100 ||
        !entry.items.every((item: unknown) => item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string')) {
      memory.delete(key);
      localStorage.removeItem(key);
      return undefined;
    }
    memory.set(key, entry);
    return entry.items as T[];
  } catch { return undefined; }
}
export function writeListCache(key: string, items: unknown[]) {
  try {
    const entry = { expires: Date.now() + MAX_AGE, items: snapshot(items) };
    memory.set(key, entry);
    localStorage.setItem(key, JSON.stringify(entry));
  } catch { /* Quota/private browsing must never prevent displaying live data. */ }
}
export function clearListCache() {
  ++epoch; // Invalidate pending writes, including responses after sign-out.
  memory.clear();
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch { /* Storage may be unavailable. */ }
}
