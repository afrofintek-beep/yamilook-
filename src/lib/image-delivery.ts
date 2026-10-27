/**
 * Transform ONLY unsigned public image objects on this application's Supabase
 * origin. Authenticated, signed, external, animated and SVG URLs are unchanged.
 * The caller must retry the original URL if the image transformer is unavailable.
 */
export function optimizedPublicImageUrl(
  src: string | null | undefined,
  width: number,
  projectUrl: string = import.meta.env.VITE_SUPABASE_URL || '',
): string | undefined {
  if (!src) return undefined;
  try {
    if (!projectUrl || !Number.isInteger(width) || width < 1 || width > 1600) return src;
    const url = new URL(src);
    if (url.origin !== new URL(projectUrl).origin || url.search || url.hash) return src;
    const prefix = '/storage/v1/object/public/';
    if (!url.pathname.startsWith(prefix)) return src;
    const key = url.pathname.slice(prefix.length);
    if (!key.includes('/') || !/\.(?:jpe?g|png|webp|avif)$/i.test(key)) return src;
    url.pathname = '/storage/v1/render/image/public/' + key;
    url.searchParams.set('width', String(width));
    url.searchParams.set('quality', '75');
    return url.toString();
  } catch {
    return src;
  }
}
