import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadPublicPost, isVideo } from '../../shared/public-post.mjs';
import PostShareDialog from '@/components/sharing/PostShareDialog';
import { useTranslation } from 'react-i18next';

type PublicPostData = Awaited<ReturnType<typeof loadPublicPost>>;

// Fallback for in-app navigation and existing service workers. Direct links are
// server-rendered by /api/public-post, including their Open Graph metadata.
function PublicVideo({ url, first }: { url: string; first: boolean }) {
  const [muted, setMuted] = useState(true);
  return <div className="relative h-[calc(100svh-64px)] min-h-60 bg-black">
    <video src={url} controls playsInline autoPlay={first} muted={muted} preload="metadata" aria-label="Vídeo da publicação" onVolumeChange={(event) => setMuted(event.currentTarget.muted)} className="h-full w-full object-contain" />
    <button type="button" className="absolute right-3 top-3 min-h-11 rounded-xl bg-black/70 px-4 text-white" onClick={(event) => {
      const video = event.currentTarget.previousElementSibling as HTMLVideoElement;
      video.muted = !video.muted;
      setMuted(video.muted);
      if (video.paused) void video.play().catch(() => {});
    }}>{muted ? 'Ativar som' : 'Silenciar'}</button>
  </div>;
}

export default function PublicPost() {
  const { postId } = useParams();
  const { t } = useTranslation();
  const [post, setPost] = useState<PublicPostData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showShare, setShowShare] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let active = true;
    setLoading(true); setError(false); setPost(null);
    loadPublicPost(postId, {
      url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      signal: controller.signal,
    }).then((result) => { if (active) setPost(result); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); window.clearTimeout(timeout); });
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [postId, attempt]);
  return (
    <main className="min-h-screen bg-background pb-10 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-[1100px]">
        <nav className="flex h-16 items-center justify-between px-4"><a href="/welcome" className="text-xl font-bold">Yamilook</a><a href="/login">{t('auth.login', 'Entrar')}</a></nav>
        {loading ? <p role="status">{t('common.loading', 'A carregar…')}</p> : error ? <div role="alert"><p>{t('publicPost.error', 'Não foi possível carregar a publicação.')}</p><Button onClick={() => setAttempt((value) => value + 1)}>{t('common.retry', 'Tentar novamente')}</Button></div> : !post ? <p>{t('publicPost.unavailable', 'Esta publicação não está disponível publicamente.')}</p> : (
          <article className="overflow-hidden bg-card p-4">
            {post.media_urls.length > 0 && <div className="-mx-4 -mt-4 mb-4 space-y-1">{post.media_urls.map((url, i) => isVideo(url) ? <PublicVideo key={url} url={url} first={i === 0} /> : <img key={url} src={url} alt={t('publicPost.photo', 'Fotografia da publicação')} loading={i ? 'lazy' : 'eager'} className="h-[calc(100svh-64px)] min-h-60 w-full bg-black object-contain" />)}</div>}
            <header className="flex items-center gap-3">
              {post.author.avatar_url && <img src={post.author.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />}
              <div><h1 className="font-semibold">{post.author.display_name}</h1><p className="text-sm text-muted-foreground">{t('publicPost.public', 'Publicação pública')}</p></div>
            </header>
            {post.content && <p className="my-5 whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>}

            <div className="flex items-center gap-3">
              <Button asChild className="min-h-11 flex-1"><a href="/feed">{t('publicPost.viewInYamilook', 'Ver na Yamilook')}</a></Button>
              <Button variant="secondary" size="icon" className="min-h-11 min-w-11" aria-label={t('publicPost.share', 'Partilhar')} aria-haspopup="dialog" onClick={() => setShowShare(true)}><Share2 className="h-5 w-5" aria-hidden="true" /></Button>
            </div>
            {showShare && <PostShareDialog id={post.id} mediaUrls={post.media_urls} open={showShare} onOpenChange={setShowShare} />}
          </article>
        )}
      </div>
    </main>
  );
}
