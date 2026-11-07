import { cn } from '@/lib/utils';

/** Official KOSOLOLA mark. Keep its teal background and white symbol intact. */
export default function KosololaLogo({ className, alt = '', width = 24, height = width }: {
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
}) {
  return <img src="/papos-app/kosolola-icon-192.png" alt={alt} width={width} height={height}
    draggable={false} className={cn('shrink-0 rounded-[22%] object-contain', className)} />;
}
