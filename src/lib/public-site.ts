/** Explicit build configuration isolates staging callbacks from production. */
export function resolveYamilookPublicOrigin(configured?: string): string {
  if (!configured?.trim()) return 'https://www.yamilook.com';
  const url = new URL(configured.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('VITE_YAMILOOK_PUBLIC_ORIGIN must be an HTTPS origin');
  }
  return url.origin;
}

export const YAMILOOK_PUBLIC_ORIGIN = resolveYamilookPublicOrigin(import.meta.env.VITE_YAMILOOK_PUBLIC_ORIGIN);

export function getYamilookPublicUrl(path: `/${string}` = '/'): string {
  if (path.startsWith('//')) throw new Error("Expected an application path, not an external URL");
  return new URL(path, YAMILOOK_PUBLIC_ORIGIN).toString();
}
