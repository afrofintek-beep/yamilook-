/**
 * Image derivatives are an optional presentation layer only. Stored originals
 * and access controls are untouched. Never rewrite private/signed, external,
 * query-bearing, animated or SVG media.
 *
 * Both dimensions are essential: a width-only CDN response on iPhone was
 * previously observed as 128x3088 (portrait) rather than a small avatar.
 */
export type PublicImageVariant = {
  width: number;
  height: number;
  resize: 'contain' | 'cover';
  quality?: number;
};

export function optimizedPublicImageUrl(
  src: string | null | undefined,
  variant: PublicImageVariant,
  projectUrl: string = import.meta.env.VITE_SUPABASE_URL || '',
): string | undefined {
  if (!src) return undefined;
  try {
    if (!projectUrl) return src;
    const { width, height, resize, quality = 75 } = variant;
    if (![width, height, quality].every(Number.isInteger)
      || width < 1 || height < 1 || width > 2500 || height > 2500
      || quality < 20 || quality > 100
      || !['contain', 'cover'].includes(resize)) return src;
    const sourceUrl = new URL(src);
    const expectedOrigin = new URL(projectUrl).origin;
    if (sourceUrl.origin !== expectedOrigin || sourceUrl.search || sourceUrl.hash) return src;
    const prefix = '/storage/v1/object/public/';
    if (!sourceUrl.pathname.startsWith(prefix)) return src;
    const objectKey = sourceUrl.pathname.slice(prefix.length);
    if (!objectKey.includes('/') || !/\.(jpe?g|png|webp|avif)$/i.test(objectKey)) return src;
    sourceUrl.pathname = '/storage/v1/render/image/public/' + objectKey;
    sourceUrl.searchParams.set('width', String(width));
    sourceUrl.searchParams.set('height', String(height));
    sourceUrl.searchParams.set('resize', resize);
    sourceUrl.searchParams.set('quality', String(quality));
    return sourceUrl.toString();
  } catch {
    return src;
  }
}

/** Fallback when a CDN returns an incorrect intrinsic geometry (or fails). */
export function imageFitsVariant(
  naturalWidth: number, naturalHeight: number, variant: PublicImageVariant,
): boolean {
  if (!naturalWidth || !naturalHeight) return false;
  if (variant.resize === 'cover') {
    // Tiny originals can stay tiny; cover still must have a square-ish shape.
    return Math.abs(naturalWidth / naturalHeight - variant.width / variant.height) < 0.08;
  }
  return naturalWidth <= variant.width + 2 && naturalHeight <= variant.height + 2;
}
