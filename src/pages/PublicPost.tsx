import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { loadPublicPost, isVideo, postUrl } from '../../shared/public-post.mjs';
import { sharePostLink } from '@/lib/post-sharing';
import { useTranslation } from 'react-i18next';

type PublicPostData = Awaited<ReturnType<typeof loadPublicPost>>;

// Fallback for in-app navigation and existing service workers. Direct links are
// server-rendered by /api/public-post, including their Open Graph metadata.
export default function PublicPost() {
  const { postId } = useParams();
  const { t } = useTranslation();
  const [post, setPost] = useState<PublicPostData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('');
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
    <main className="min-h-screen bg-background px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-xl">
        <nav className="mb-6 flex items-center justify-between"><a href="/welcome" className="text-xl font-bold">Yamilook</a><a href="/login">{t('auth.login', 'Entrar')}</a></nav>
        {loading ? <p role="status">{t('common.loading', 'A carregar…')}</p> : error ? <div role="alert"><p>{t('publicPost.error', 'Não foi possível carregar a publicação.')}</p><Button onClick={() => setAttempt((value) => value + 1)}>{t('common.retry', 'Tentar novamente')}</Button></div> : !post ? <p>{t('publicPost.unavailable', 'Esta publicação não está disponível publicamente.')}</p> : (
          <article className="overflow-hidden rounded-2xl border bg-card p-4">
            <header className="flex items-center gap-3">
              {post.author.avatar_url && <img src={post.author.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />}
              <div><h1 className="font-semibold">{post.author.display_name}</h1><p className="text-sm text-muted-foreground">{t('publicPost.public', 'Publicação pública')}</p></div>
            </header>
            {post.content && <p className="my-5 whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>}
            <div className="-mx-4 my-4 space-y-3">{post.media_urls.map((url, i) => isVideo(url) ? <video key={url} src={url} controls playsInline preload="metadata" className="max-h-[75vh] w-full bg-black" /> : <img key={url} src={url} alt={t('publicPost.photo', 'Fotografia da publicação')} loading={i ? 'lazy' : 'eager'} className="max-h-[75vh] w-full object-contain" />)}</div>
            <Button onClick={async () => {
              try {
                const result = await sharePostLink(post.id, { title: `${post.author.display_name} — Yamilook` });
                if (result === 'copied') setStatus(t('feed.linkCopied', 'Ligação copiada'));
              } catch { setStatus(t('publicPost.copyManually', 'Seleciona e copia a ligação abaixo.')); }
            }}>{t('publicPost.share', 'Partilhar')}</Button>
            <p role="status" className="my-3 text-sm">{status}</p>
            <input aria-label={t('publicPost.link', 'Ligação pública')} readOnly value={postUrl(post.id)} onFocus={(event) => event.target.select()} className="w-full rounded border bg-background p-3 text-xs" />
          </article>
        )}
      </div>
    </main>
  );
}
