import { useId } from 'react';
import { cn } from '@/lib/utils';
import { useAppSurface } from '@/lib/app-surface';

/** Keep the original mark; match Yamilook's yellow while preserving standalone branding. */
export default function KosololaLogo({ className, alt = '', width = 24, height = width }: {
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
}) {
  const surface = useAppSurface();
  const id = useId().replace(/:/g, '');
  if (surface === 'papos') {
    return <img src="/papos-app/kosolola-icon-192.png" alt={alt} width={width} height={height}
      draggable={false} className={cn('shrink-0 rounded-[22%] object-contain', className)} />;
  }
  // The original white silhouette becomes an alpha mask. The teal background is
  // excluded using its red channel, without tracing or redrawing either bubble.
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="50 90 412 344"
    width={width} height={height} className={cn('shrink-0', className)}
    role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
    <defs>
      <filter id={`${id}-silhouette`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3 0 0 0 -1.5" />
      </filter>
      <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512" style={{ maskType: 'alpha' }}>
        <image href="/papos-app/kosolola-icon-512.png" width="512" height="512" filter={`url(#${id}-silhouette)`} />
      </mask>
    </defs>
    <rect width="512" height="512" fill="#e9bd3d" mask={`url(#${id}-mask)`} />
  </svg>;
}
