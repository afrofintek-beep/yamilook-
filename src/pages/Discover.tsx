import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, Users, Hash, ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PostCard } from '@/components/feed/PostCard';
import { CommentsSheet } from '@/components/feed/CommentsSheet';
import { LocalBusinessSection } from '@/components/advertising/LocalBusinessSection';
import BottomNav from '@/components/BottomNav';
import { usePosts, PostWithUser, Topic } from '@/hooks/usePosts';
import { useAdvertising, LocationMarket } from '@/hooks/useAdvertising';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { snapToGrid } from '@/lib/geo-privacy';
import { cn } from '@/lib/utils';

interface DiscoverUser {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
}

export default function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { discoverPosts, topics, loading, getPostsByTopic } = usePosts();
  const { locationMarkets } = useAdvertising();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topicPosts, setTopicPosts] = useState<PostWithUser[]>([]);
  const [loadingTopicPosts, setLoadingTopicPosts] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostWithUser | null>(null);
  const [activeTab, setActiveTab] = useState('trending');
  const [userCity, setUserCity] = useState<string | undefined>();
  const [userMarket, setUserMarket] = useState<LocationMarket | undefined>();
  const [discoverUsers, setDiscoverUsers] = useState<DiscoverUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Handle topic from URL query param
  useEffect(() => {
    const topicId = searchParams.get('topic');
    if (topicId && topics.length > 0) {
      const topic = topics.find(t => t.id === topicId);
      if (topic && (!selectedTopic || selectedTopic.id !== topicId)) {
        setSelectedTopic(topic);
      }
    }
  }, [searchParams, topics, selectedTopic]);

  // Update URL when topic changes
  const handleTopicSelect = (topic: Topic | null) => {
    setSelectedTopic(topic);
    if (topic) {
      setSearchParams({ topic: topic.id });
    } else {
      setSearchParams({});
    }
  };

  // Fetch users for discover
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase
          .from('public_profiles')
          .select('id, display_name, username, avatar_url, bio')
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (error) throw error;
        setDiscoverUsers(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };
    
    fetchUsers();
  }, []);

  // Auto-detect user location: use Banda from profile first, then try GPS silently
  useEffect(() => {
    if (locationMarkets.length === 0) return;

    // 1. Use the user's Banda city from profile as immediate default
    const profileCity = profile?.city;
    const bandaMarket = profileCity
      ? locationMarkets.find(m => m.city.toLowerCase() === profileCity.toLowerCase())
      : undefined;

    const fallbackMarket = bandaMarket || locationMarkets.find(m => m.city === 'Luanda') || locationMarkets[0];

    if (fallbackMarket && !userCity) {
      setUserCity(fallbackMarket.city);
      setUserMarket(fallbackMarket);
    }

    // 2. Try GPS silently in background to refine location (only if permission already granted)
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const _cell = snapToGrid(position.coords.latitude, position.coords.longitude);
              const latitude = _cell.lat;
              const longitude = _cell.lng;
              let nearest: LocationMarket | undefined;
              let minDist = Infinity;
              for (const market of locationMarkets) {
                const dist = Math.sqrt(
                  Math.pow(market.latitude - latitude, 2) +
                  Math.pow(market.longitude - longitude, 2)
                );
                if (dist < minDist) {
                  minDist = dist;
                  nearest = market;
                }
              }
              if (nearest) {
                setUserCity(nearest.city);
                setUserMarket(nearest);
              }
            },
            () => { /* silently ignore */ },
            { enableHighAccuracy: false, timeout: 5000 }
          );
        }
        // If 'prompt' or 'denied', don't ask — use the Banda fallback
      }).catch(() => {
        // permissions API not supported — don't trigger popup
      });
    }
  }, [locationMarkets, profile?.city]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch posts when topic is selected
  useEffect(() => {
    if (selectedTopic) {
      setLoadingTopicPosts(true);
      getPostsByTopic(selectedTopic.id)
        .then(posts => {
          setTopicPosts(posts);
          setLoadingTopicPosts(false);
        })
        .catch(() => {
          setTopicPosts([]);
          setLoadingTopicPosts(false);
        });
    } else {
      setTopicPosts([]);
    }
  }, [selectedTopic, getPostsByTopic]);

  const trendingTopics = topics.filter(t => t.is_trending);

  // Use topic posts when a topic is selected, otherwise use discover posts
  const filteredPosts = selectedTopic ? topicPosts : discoverPosts;

  // Helper function to get translated topic name
  const getTopicName = (topic: Topic) => {
    const translatedName = t(`discover.topicNames.${topic.slug}`, { defaultValue: '' });
    return translatedName || topic.name;
  };

  const handleCommentClick = (post: PostWithUser) => {
    setSelectedPost(post);
    setCommentsOpen(true);
  };

  return (
    <div className="h-screen-safe overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))] bg-background flex flex-col">
      {/* Header */}
      <header className="shrink-0 relative z-50 bg-background/95 backdrop-blur-sm border-b border-border/50 safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full"
            onClick={() => navigate('/feed')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('discover.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-full bg-secondary/50 border-none"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Topic filter */}
        {selectedTopic && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <Badge 
              variant="secondary" 
              className="gap-1 cursor-pointer"
              onClick={() => handleTopicSelect(null)}
            >
              <Hash className="w-3 h-3" />
              {getTopicName(selectedTopic)}
              <X className="w-3 h-3 ml-1" />
            </Badge>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* Local Businesses Section */}
        {!selectedTopic && !searchQuery && (
          <LocalBusinessSection 
            userCity={userCity}
            userMarket={userMarket}
            onViewAll={() => navigate('/advertising')}
          />
        )}

        {/* Trending topics */}
        {!selectedTopic && !searchQuery && (
          <div className="py-4">
            <h3 className="text-sm font-semibold text-muted-foreground px-4 mb-3">
              {t('discover.sections.bandaGrowing')}
            </h3>
            <div className="overflow-x-auto scrollbar-hide touch-pan-x">
              <div 
                className="flex gap-3 px-4 pb-2 w-max"
                style={{ 
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {trendingTopics.map((topic, index) => (
                  <motion.button
                    key={topic.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ delay: index * 0.05, type: "spring", stiffness: 300 }}
                    onClick={() => handleTopicSelect(topic)}
                    className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 min-w-[140px] cursor-pointer shadow-sm hover:shadow-md hover:border-primary/40 active:shadow-inner transition-shadow"
                  >
                    <TrendingUp className="w-5 h-5 text-primary mb-2" />
                    <p className="font-semibold text-sm">{getTopicName(topic)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {topic.post_count} {t('discover.posts')}
                    </p>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="sticky top-0 z-10 bg-background pt-2 pb-2">
            <TabsList className="mx-4 bg-secondary/50">
              <TabsTrigger value="trending" className="flex-1 gap-1">
                <TrendingUp className="w-4 h-4" />
                {t('discover.trending')}
              </TabsTrigger>
              <TabsTrigger value="people" className="flex-1 gap-1">
                <Users className="w-4 h-4" />
                {t('discover.people')}
              </TabsTrigger>
              <TabsTrigger value="topics" className="flex-1 gap-1">
                <Hash className="w-4 h-4" />
                {t('discover.topics')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="trending" className="mt-0 pb-20">
            {(loading || loadingTopicPosts) ? (
              <div className="p-4 space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-64 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                <TrendingUp className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {selectedTopic ? t('discover.noPostsForTopic') : t('discover.nothingTrending')}
                </h3>
                <p className="text-muted-foreground">
                  {selectedTopic ? t('discover.noPostsForTopicDescription') : t('discover.checkBackLater')}
                </p>
                {selectedTopic && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => handleTopicSelect(null)}
                  >
                    {t('discover.viewAllPosts')}
                  </Button>
                )}
              </div>
            ) : (
              <AnimatePresence>
                {filteredPosts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <PostCard 
                      post={post} 
                      onCommentClick={() => handleCommentClick(post)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </TabsContent>

          <TabsContent value="people" className="mt-0 px-4 pb-20">
            <div className="space-y-2">
              {loadingUsers ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-full" />
                  </div>
                ))
              ) : discoverUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('discover.noUsers')}</h3>
                  <p className="text-muted-foreground">{t('discover.noUsersDescription')}</p>
                </div>
              ) : (
                discoverUsers.map((user, i) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/50 cursor-pointer"
                    onClick={() => navigate(`/profile/${user.id}`)}
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-primary text-white">
                        {user.display_name?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{user.display_name}</p>
                      <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-full flex-shrink-0">
                      {t('profile.follow')}
                    </Button>
                  </motion.div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="topics" className="mt-0 px-4 pb-20">
            <div className="grid grid-cols-2 gap-3">
              {topics.map((topic, index) => (
                <motion.button
                  key={topic.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleTopicSelect(topic)}
                  className={cn(
                    "p-4 rounded-2xl text-left transition-colors",
                    topic.is_trending 
                      ? "bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20"
                      : "bg-secondary/50 hover:bg-secondary"
                  )}
                >
                  <Hash className={cn("w-5 h-5 mb-2", topic.is_trending && "text-primary")} />
                  <p className="font-semibold">{getTopicName(topic)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {topic.post_count} {t('discover.posts')}
                  </p>
                </motion.button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />

      {/* Comments Sheet */}
      <CommentsSheet 
        open={commentsOpen} 
        onOpenChange={setCommentsOpen} 
        post={selectedPost}
      />
    </div>
  );
}
