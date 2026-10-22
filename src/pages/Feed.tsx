import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, Search, MessageCircle, Radio, Loader2, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PostCard } from '@/components/feed/PostCard';
import { FeedSidebar } from '@/components/feed/FeedSidebar';
import { CreatePostSheet } from '@/components/feed/CreatePostSheet';
import { CommentsSheet } from '@/components/feed/CommentsSheet';
import { StatusList } from '@/components/status/StatusList';
import { SponsoredPostCard } from '@/components/advertising/SponsoredPostCard';
import BottomNav from '@/components/BottomNav';
import { FeedSkeleton } from '@/components/ui/ShimmerSkeleton';
import { preloadImages } from '@/components/ui/OptimizedImage';
import { LiveIndicatorBadge } from '@/components/live/LiveIndicatorBadge';
import { LivePreviewTooltip } from '@/components/live/LivePreviewTooltip';
import { usePosts, PostWithUser } from '@/hooks/usePosts';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useAdvertising, Advertisement, BusinessProfile } from '@/hooks/useAdvertising';
import { useActiveStreams } from '@/hooks/useActiveStreams';
import { useArchivedPosts } from '@/hooks/useArchivedPosts';
import YamilookLogo from '@/components/brand/YamilookLogo';

export default function Feed() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { feedPosts, loading, fetchFeedPosts, loadMoreFeedPosts, hasMoreFeed, loadingMoreFeed, newPostsCount } = usePosts();
  const { fetchActiveAdsForFeed, interleaveAdsInFeed } = useAdvertising();
  const { hasActiveStreams, activeStreams } = useActiveStreams();
  const { archivedPostIds, fetchArchivedIds, toggleArchive, isArchived } = useArchivedPosts();
  
  const [createOpen, setCreateOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostWithUser | null>(null);
  type FeedItem = PostWithUser | (Advertisement & { business: BusinessProfile; isAd: true });
  const [feedWithAds, setFeedWithAds] = useState<FeedItem[]>([]);

  // Refresh feed when create sheet closes (different hook instances don't share state)
  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) {
      fetchFeedPosts();
    }
  };

  // Load archived post IDs on mount
  useEffect(() => {
    fetchArchivedIds();
  }, [fetchArchivedIds]);

  // Load ads and interleave with feed, filtering out archived posts
  useEffect(() => {
    const loadAds = async () => {
      // Filter out archived posts
      const visiblePosts = feedPosts.filter(p => !archivedPostIds.has(p.id));
      
      if (visiblePosts.length === 0) {
        setFeedWithAds([]);
        return;
      }
      const ads = await fetchActiveAdsForFeed(undefined, visiblePosts.length);
      const combined = interleaveAdsInFeed(visiblePosts, ads);
      setFeedWithAds(combined);
    };
    loadAds();
  }, [feedPosts, archivedPostIds, fetchActiveAdsForFeed, interleaveAdsInFeed]);

  // Preload images for first 5 posts (Instagram-style prefetching)
  useEffect(() => {
    if (feedPosts.length > 0) {
      const imageUrls = feedPosts
        .slice(0, 5)
        .flatMap(post => post.media_urls || []);
      preloadImages(imageUrls);
    }
  }, [feedPosts]);

  const handleCommentClick = (post: PostWithUser) => {
    setSelectedPost(post);
    setCommentsOpen(true);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const handleShowNewPosts = () => {
    fetchFeedPosts();
    const vp = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    vp?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pull-to-refresh on the feed viewport
  const { pullDistance, refreshing: refreshingFeed } = usePullToRefresh({
    onRefresh: () => fetchFeedPosts(),
    getScrollElement: () => scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null,
  });

  // Infinite scroll: observe a sentinel at the bottom of the (Radix ScrollArea)
  // list and load the next page as it approaches the viewport.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMoreFeed) return;
    const root = sentinel.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreFeedPosts();
      },
      { root, rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreFeed, loadMoreFeedPosts, feedWithAds.length]);

  return (
    <div className="h-screen-safe overflow-hidden bg-muted/30 flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* Header - Clean, minimal */}
      <header className="relative z-50 shrink-0 bg-card border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-2 mx-auto w-full max-w-[940px]">
          <YamilookLogo size="sm" showTagline={false} animate={false} bgClassName="bg-card" />
          <div className="flex items-center gap-1">
            <LivePreviewTooltip activeStreams={activeStreams} hasActiveStreams={hasActiveStreams}>
              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full text-destructive"
                  onClick={() => navigate('/live')}
                >
                  <Radio className="w-5 h-5" />
                </Button>
                {hasActiveStreams && <LiveIndicatorBadge />}
              </div>
            </LivePreviewTooltip>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full"
              onClick={() => navigate('/discover')}
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full"
              onClick={() => navigate('/')}
            >
              <MessageCircle className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* New-posts pill (realtime) */}
      {newPostsCount > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 top-[calc(4rem+env(safe-area-inset-top,0px))] z-40">
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleShowNewPosts}
            className="flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 shadow-lg"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            {newPostsCount} {newPostsCount === 1 ? 'novo post' : 'novos posts'}
          </motion.button>
        </div>
      )}

      <ScrollArea ref={scrollRef} className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]]:overscroll-y-contain">
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-start justify-center overflow-hidden"
          style={{ height: refreshingFeed ? 44 : pullDistance, transition: 'height 0.2s ease' }}
        >
          <Loader2
            className={`w-5 h-5 text-muted-foreground mt-3 ${refreshingFeed ? 'animate-spin' : ''}`}
            style={refreshingFeed ? undefined : { opacity: Math.min(pullDistance / 70, 1), transform: `rotate(${pullDistance * 3}deg)` }}
          />
        </div>
        {/* Centered feed card + desktop-only right rail (Instagram/Facebook-like) */}
        <div className="mx-auto w-full max-w-[940px] lg:flex lg:gap-6 lg:items-start lg:px-4 lg:pt-4">
          <main className="w-full lg:max-w-[600px] lg:flex-1 bg-card lg:rounded-2xl lg:border lg:border-border lg:overflow-hidden lg:shadow-sm">
        {/* Status stories */}
        <div className="border-b border-border">
          <StatusList />
        </div>

        {/* Feed posts */}
        <div className="bg-card">
          {loading ? (
            <FeedSkeleton count={3} />
          ) : feedPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Ainda não há partilhas na tua comunidade</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Partilha o que se passa à tua volta.
              </p>
              <Button 
                className="rounded-full bg-primary text-primary-foreground px-6"
                onClick={() => handleCreateOpenChange(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar publicação
              </Button>
            </div>
          ) : feedWithAds.length === 0 ? null : (
            <>
              {feedWithAds.map((item) => (
                <div key={item.id}>
                  {'isAd' in item ? (
                    <div className="py-2">
                      <SponsoredPostCard ad={item} />
                    </div>
                  ) : (
                    <PostCard 
                      post={item} 
                      onCommentClick={() => handleCommentClick(item)}
                      isArchived={isArchived(item.id)}
                      onToggleArchive={toggleArchive}
                    />
                  )}
                </div>
              ))}
              {hasMoreFeed && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
              {loadingMoreFeed && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </div>
          </main>
          <aside className="hidden lg:block w-[300px] shrink-0">
            <FeedSidebar activeStreams={activeStreams} />
          </aside>
        </div>
      </ScrollArea>

      {/* FAB - Amber for action */}
      <motion.button 
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        onClick={() => handleCreateOpenChange(true)}
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      <BottomNav />

      {/* Sheets */}
      <CreatePostSheet open={createOpen} onOpenChange={handleCreateOpenChange} />
      <CommentsSheet 
        open={commentsOpen} 
        onOpenChange={setCommentsOpen} 
        post={selectedPost}
      />
    </div>
  );
}
