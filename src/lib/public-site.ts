/**
 * Canonical public origin for user-facing YAMILOOK links and Supabase Auth callbacks.
 * Do not derive these URLs from window.location.origin: it may be a Vercel preview.
 */
export const YAMILOOK_PUBLIC_ORIGIN = 'https://www.yamilook.com';

export function getYamilookPublicUrl(path: `/${string}` = '/'): string {
  if (path.startsWith('//')) throw new Error('Expected an application path, not an external URL');
  return new URL(path, YAMILOOK_PUBLIC_ORIGIN).toString();
}
