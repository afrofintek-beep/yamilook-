import { useQuery } from '@tanstack/react-query';
import { loadPublicPost, postUrl, isVideo } from '../../../shared/public-post.mjs';

export function fetchSharedPost(id: string, signal?: AbortSignal) {
  return loadPublicPost(id, { url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, signal });
}
export default function PostSharePreview({ id, interactive = true }: { id: string; interactive?: boolean }) {
  const { data: post, isPending, isError } = useQuery({ queryKey: ['shared-public-post', id], queryFn: ({ signal }) => fetchSharedPost(id, signal), staleTime: 0, refetchOnWindowFocus: true, retry: 1 });
  const media = post?.media_urls[0];
  return <a onClick={event => { if (!interactive) event.preventDefault(); }} href={postUrl(id)} target="_blank" rel="noopener noreferrer" className="block min-w-0 max-w-sm overflow-hidden rounded-xl border bg-background/80 text-foreground" aria-label="Abrir publicação no Yamilook">
    {media && (isVideo(media) ? <div className="relative"><video src={media.includes('#') ? media : `${media}#t=0.1`} muted playsInline preload="metadata" className="h-36 w-full bg-black object-contain" aria-label="Pré-visualização do vídeo" /><span className="pointer-events-none absolute inset-0 grid place-items-center text-3xl text-white" aria-hidden="true">▶</span></div> : <img src={media} alt="Fotografia da publicação" loading="lazy" className="max-h-44 w-full object-cover" />)}
    <div className="space-y-1 p-3"><span className="text-xs font-semibold text-primary">YAMILOOK</span>
      {post ? <><p className="font-semibold">{post.author.display_name}</p><p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{post.content}</p></> : <p className="text-sm">{isPending ? 'A carregar publicação…' : isError ? 'Pré-visualização indisponível.' : 'Esta publicação já não está disponível publicamente.'}</p>}
      <p className="text-xs text-muted-foreground">Abrir publicação ↗</p>
    </div>
  </a>;
}
