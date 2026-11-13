import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePosts, type PostWithUser } from '@/hooks/usePosts';
import { PostCard } from '@/components/feed/PostCard';
import { CommentsSheet } from '@/components/feed/CommentsSheet';
import { ProfilePostPhotos } from './ProfilePostPhotos';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ProfileMuxi({ userId }: { userId: string }) {
  useUiLocale();
  const { user } = useAuth();
  const { getUserPosts } = usePosts({ autoLoad: false });
  const [tab, setTab] = useState<'posts' | 'photos'>('posts');
  const [openedPostId, setOpenedPostId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostWithUser | null>(null);
  const { data: posts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['profile-muxi', user?.id, userId],
    enabled: !!user,
    queryFn: () => getUserPosts(userId),
    staleTime: 0,
  });
  const openedPost = posts.find(post => post.id === openedPostId);
  return (
    <section id="profile-muxi" aria-label={uiText("Muxi deste perfil")} className="mb-6 scroll-mt-4">
      <div className="px-4 mb-3 flex gap-2" role="group" aria-label={uiText('Conteúdo do perfil')}>
        <Button variant={tab === 'posts' ? 'default' : 'outline'} aria-pressed={tab === 'posts'} onClick={() => setTab('posts')}>{uiText('Muxi')}</Button>
        <Button variant={tab === 'photos' ? 'default' : 'outline'} aria-pressed={tab === 'photos'} onClick={() => setTab('photos')}>{uiText('Fotos')}</Button>
      </div>
      {isLoading && <p role="status" className="px-4 text-sm text-muted-foreground">{uiText("A carregar publicações…")}</p>}
      {isError && <div role="alert" className="px-4 text-sm">{uiText("Não foi possível carregar as publicações.")}<Button variant="outline" size="sm" onClick={() => void refetch()}>{uiText("Tentar novamente")}</Button>
      </div>}
      {tab === 'posts' && !isLoading && !isError && posts.length === 0 && <p className="px-4 text-sm text-muted-foreground">{uiText("Sem publicações disponíveis para ti neste perfil.")}</p>}
      {tab === 'posts' && posts.map(post => <PostCard key={post.id} post={post} onCommentClick={() => setSelectedPost(post)} />)}
      {tab === 'photos' && !isLoading && !isError && <ProfilePostPhotos key={`${user?.id}:${userId}`} posts={posts} onOpenPost={post => setOpenedPostId(post.id)} />}
      <Dialog open={!!openedPost} onOpenChange={open => { if (!open) setOpenedPostId(null); }}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>{uiText('Publicação')}</DialogTitle>
          {openedPost && <PostCard post={openedPost} onCommentClick={() => { setOpenedPostId(null); setSelectedPost(openedPost); }} />}
        </DialogContent>
      </Dialog>
      <CommentsSheet open={!!selectedPost} onOpenChange={open => { if (!open) setSelectedPost(null); }} post={selectedPost} />
    </section>
  );
}
