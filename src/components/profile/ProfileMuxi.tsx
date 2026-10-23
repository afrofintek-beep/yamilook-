import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePosts, type PostWithUser } from '@/hooks/usePosts';
import { PostCard } from '@/components/feed/PostCard';
import { CommentsSheet } from '@/components/feed/CommentsSheet';
import { Button } from '@/components/ui/button';

export function ProfileMuxi({ userId }: { userId: string }) {
  const { user } = useAuth();
  const { getUserPosts } = usePosts({ autoLoad: false });
  const [selectedPost, setSelectedPost] = useState<PostWithUser | null>(null);
  const { data: posts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['profile-muxi', user?.id, userId],
    enabled: !!user,
    queryFn: () => getUserPosts(userId),
    staleTime: 0,
  });
  return (
    <section id="profile-muxi" aria-label="Muxi deste perfil" className="mb-6 scroll-mt-4">
      <h2 className="px-4 mb-3 text-sm font-bold">Muxi</h2>
      {isLoading && <p role="status" className="px-4 text-sm text-muted-foreground">A carregar publicações…</p>}
      {isError && <div role="alert" className="px-4 text-sm">
        Não foi possível carregar as publicações.
        <Button variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button>
      </div>}
      {!isLoading && !isError && posts.length === 0 && <p className="px-4 text-sm text-muted-foreground">Sem publicações disponíveis para ti neste perfil.</p>}
      {posts.map(post => <PostCard key={post.id} post={post} onCommentClick={() => setSelectedPost(post)} />)}
      <CommentsSheet open={!!selectedPost} onOpenChange={open => { if (!open) setSelectedPost(null); }} post={selectedPost} />
    </section>
  );
}
