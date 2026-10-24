import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';
import { useEffect } from 'react';
import { useResolvedMediaUrl } from './MediaPreview';
import { privateChatPath } from '@/lib/private-chat-media';

export function ChatMediaLink({ href = '', children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { resolvedUrl, error, retry } = useResolvedMediaUrl(href);
  useEffect(() => {
    if (!privateChatPath(href)) return;
    const timer = window.setInterval(retry, 240000);
    return () => window.clearInterval(timer);
  }, [href, retry]);
  return <a {...props} href={resolvedUrl} aria-disabled={!resolvedUrl || error} onClick={event => {
    if (!resolvedUrl || error) event.preventDefault();
    props.onClick?.(event);
  }}>{error ? 'Ficheiro indisponível' : children}</a>;
}
export function ChatMediaImage({ src = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const { resolvedUrl, onError } = useResolvedMediaUrl(src);
  return <img {...props} src={resolvedUrl} onError={() => void onError()} />;
}
