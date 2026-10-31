import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchPublicProfilesBatched } from '@/lib/public-profile-batch';
import { preparePostImage } from '@/lib/post-image';
import { useAuth } from './useAuth';
import { ReactionCounts, createEmptyReactionCounts, normalizeReactionType } from '@/lib/reactions';
import type { Tables } from '@/integrations/supabase/types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

const FEED_PAGE_SIZE = 20;

export interface Post {
  id: string;
  user_id: string;
  type: 'text' | 'photo' | 'video' | 'link';
  content: string | null;
  media_urls: string[];
  location: string | null;
  privacy: 'everyone' | 'contacts' | 'close_friends' | 'only_me';
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  updated_at: string;
}

export interface PostTopic {
  id: string;
  name: string;
  slug: string;
}

export interface PostWithUser extends Post {
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
  is_liked: boolean;
  my_reaction: string | null;
  is_saved: boolean;
  reaction_counts: ReactionCounts;
  topics: PostTopic[];
}

export interface CommentReaction {
  type: string;
  count: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  likes_count: number;
  created_at: string;
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
  replies?: Comment[];
  reactions: { [type: string]: number };
  my_reaction: string | null;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  post_count: number;
  is_trending: boolean;
}

export function usePosts({ autoLoad = true, loadDiscovery = true }: { autoLoad?: boolean; loadDiscovery?: boolean } = {}) {
  const { user } = useAuth();
  // Auth refreshes replace the User object even when the account is unchanged.
  // Depend on identity so a token refresh cannot reload page one mid-scroll.
  const userId = user?.id;
  // Único por instância do hook para que montagens concorrentes não colidam no
  // mesmo tópico do canal realtime do Supabase (que lança "cannot add
  // postgres_changes callbacks ... after subscribe()").
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));
  const [feedPosts, setFeedPosts] = useState<PostWithUser[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<PostWithUser[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const pendingFeedRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);
  const feedGenerationRef = useRef(0);
  const paginationFailedRef = useRef(false);
  // Feed pagination (infinite scroll)
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const loadingMoreRef = useRef(false);
  const feedCursorRef = useRef<string | null>(null); // created_at of the last loaded post
  const contactIdsRef = useRef<string[]>([]);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const newestCreatedAtRef = useRef<string | null>(null); // created_at of the top post
  const realtimeVersionsRef = useRef(new Map<string, number>());
  const feedPostsRef = useRef(feedPosts);
  feedPostsRef.current = feedPosts;

  // Batch fetch posts with user data, likes, saves, reaction counts, and topics
  const fetchPostsWithDetails = async (posts: Tables<'posts'>[], onProfilesReady?: (posts: PostWithUser[]) => void): Promise<PostWithUser[]> => {
    if (!posts.length) return [];

    // Get unique user IDs
    const userIds = [...new Set(posts.map(p => p.user_id))];
    const postIds = posts.map(p => p.id);

    // Batch fetch all profiles (safe public fields via SECURITY DEFINER RPC)
    const { data: profiles } = await supabase.rpc('get_public_profiles_by_ids', {
      p_ids: userIds,
    });

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    // Show safe public author details as soon as they are available. Reactions,
    // bookmarks and topics can fill in without holding the first render.
    const initialPosts: PostWithUser[] = posts.map(post => ({
      ...post,
      type: post.type as PostWithUser['type'],
      privacy: post.privacy as PostWithUser['privacy'],
      media_urls: post.media_urls || [],
      user: profileMap.get(post.user_id) || { id: post.user_id, display_name: 'Unknown', avatar_url: null, username: '' },
      is_liked: false,
      my_reaction: null,
      is_saved: false,
      reaction_counts: createEmptyReactionCounts(),
      topics: [],
    }));
    onProfilesReady?.(initialPosts);

    // Batch fetch likes and saves for current user + all reactions for counts
    const likesMap = new Map<string, string>();
    const savedSet = new Set<string>();
    const reactionCountsMap = new Map<string, ReactionCounts>();

    // Independent enrichment requests run together, rather than forming a waterfall.
    const [reactionsResponse, postTopicsResponse, likesResult, savedResult] = await Promise.all([
      supabase.from('post_likes').select('post_id, reaction_type').in('post_id', postIds),
      supabase.from('post_topics').select('post_id, topic_id').in('post_id', postIds),
      userId ? supabase.from('post_likes').select('post_id, reaction_type').in('post_id', postIds).eq('user_id', userId) : Promise.resolve({ data: [] }),
      userId ? supabase.from('saved_posts').select('post_id').in('post_id', postIds).eq('user_id', userId) : Promise.resolve({ data: [] }),
    ]);
    const allReactions = reactionsResponse.data;
    const postTopicsData = postTopicsResponse.data;

    // Calculate reaction counts per post (normalize legacy types into African set)
    allReactions?.forEach(reaction => {
      const postId = reaction.post_id;
      if (!reactionCountsMap.has(postId)) {
        reactionCountsMap.set(postId, createEmptyReactionCounts());
      }
      const counts = reactionCountsMap.get(postId)!;
      const africanType = normalizeReactionType(reaction.reaction_type);
      if (africanType) {
        counts[africanType]++;
      }
    });

    // Fetch topics for all posts
    // Get unique topic IDs and fetch topic details
    const topicIds = [...new Set(postTopicsData?.map(pt => pt.topic_id) || [])];
    const topicsMap = new Map<string, PostTopic>();
    
    if (topicIds.length > 0) {
      const { data: topicsData } = await supabase
        .from('discover_topics')
        .select('id, name, slug')
        .in('id', topicIds);
      
      topicsData?.forEach(t => {
        topicsMap.set(t.id, { id: t.id, name: t.name, slug: t.slug });
      });
    }

    // Build post-to-topics map
    const postTopicsMap = new Map<string, PostTopic[]>();
    postTopicsData?.forEach(pt => {
      const topic = topicsMap.get(pt.topic_id);
      if (topic) {
        const existing = postTopicsMap.get(pt.post_id) || [];
        existing.push(topic);
        postTopicsMap.set(pt.post_id, existing);
      }
    });

    if (userId) {
      likesResult.data?.forEach(l => {
        const normalized = normalizeReactionType(l.reaction_type);
        if (normalized) likesMap.set(l.post_id, normalized);
      });
      savedResult.data?.forEach(s => savedSet.add(s.post_id));
    }

    return initialPosts.map(post => ({
      ...post,
      is_liked: likesMap.has(post.id),
      my_reaction: likesMap.get(post.id) || null,
      is_saved: savedSet.has(post.id),
      reaction_counts: reactionCountsMap.get(post.id) || createEmptyReactionCounts(),
      topics: postTopicsMap.get(post.id) || [],
    }));
  };

  // A single in-flight first page per signed-in user avoids StrictMode and
  // overlapping refresh duplicates. Failed requests never leave a spinner stuck.
  const fetchFeedPosts = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    if (pendingFeedRef.current?.userId === userId) return pendingFeedRef.current.promise;
    const generation = ++feedGenerationRef.current;
    loadingMoreRef.current = false;
    setLoadingMoreFeed(false);
    const active = () => feedGenerationRef.current === generation;
    const request = (async () => {
      if (active()) setFeedError(false);
      try {
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts').select('contact_user_id').eq('user_id', userId);
        if (contactsError) throw contactsError;
        const contactIds = [...new Set([...(contacts || []).map(c => c.contact_user_id), userId])];
        const { data, error: postsError } = await supabase
          .from('posts').select('*')
          .or('user_id.in.(' + contactIds.join(',') + '),privacy.eq.everyone')
          .order('created_at', { ascending: false })
          .limit(FEED_PAGE_SIZE);
        if (postsError) throw postsError;
        if (!active()) return;
        const posts = data || [];
        contactIdsRef.current = contactIds;
        feedCursorRef.current = posts.length ? posts[posts.length - 1].created_at : null;
        newestCreatedAtRef.current = posts.length ? posts[0].created_at : null;
        paginationFailedRef.current = false;
        setLoadMoreError(false);
        setNewPostsCount(0);
        setHasMoreFeed(posts.length === FEED_PAGE_SIZE);
        if (!posts.length) {
          setFeedPosts([]);
          setLoading(false);
          return;
        }
        const detailed = await fetchPostsWithDetails(posts, initial => {
          if (active()) {
            setFeedPosts(initial);
            setLoading(false);
          }
        });
        if (active()) {
          // An infinite-scroll page may already have been appended while the
          // first page's metadata was loading. Preserve those extra posts.
          const detailsById = new Map(detailed.map(post => [post.id, post]));
          setFeedPosts(previous => previous.map(post => detailsById.get(post.id) || post));
        }
      } catch (error) {
        console.error('Unable to load feed', error);
        if (active()) setFeedError(true);
      } finally {
        if (active()) setLoading(false);
      }
    })();
    pendingFeedRef.current = { userId, promise: request };
    try { await request; }
    finally {
      if (pendingFeedRef.current?.promise === request) pendingFeedRef.current = null;
    }
  }, [userId]);

  // Load the next page (posts older than the current cursor) and append.
  const loadMoreFeedPosts = useCallback(async () => {
    if (!userId || pendingFeedRef.current || loadingMoreRef.current || !feedCursorRef.current || paginationFailedRef.current) return;
    const generation = feedGenerationRef.current;
    const active = () => feedGenerationRef.current === generation;
    setLoadMoreError(false);
    loadingMoreRef.current = true;
    setLoadingMoreFeed(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .or(`user_id.in.(${contactIdsRef.current.join(',')}),privacy.eq.everyone`)
        .lt('created_at', feedCursorRef.current)
        .order('created_at', { ascending: false })
        .limit(FEED_PAGE_SIZE);

      if (error) throw error;
      if (!active()) return;
      const posts = data || [];
      setHasMoreFeed(posts.length === FEED_PAGE_SIZE);
      if (posts.length) {
        feedCursorRef.current = posts[posts.length - 1].created_at;
        const enriched = await fetchPostsWithDetails(posts);
        if (!active()) return;
        setFeedPosts(prev => {
          const seen = new Set(prev.map(p => p.id));
          return [...prev, ...enriched.filter(p => !seen.has(p.id))];
        });
      }
    } catch (error) {
      console.error('Unable to load next page', error);
      if (!active()) return;
      paginationFailedRef.current = true;
      setLoadMoreError(true);
    } finally {
      if (active()) {
        loadingMoreRef.current = false;
        setLoadingMoreFeed(false);
      }
    }
  }, [userId]);

  const retryLoadMorePosts = useCallback(() => {
    paginationFailedRef.current = false;
    return loadMoreFeedPosts();
  }, [loadMoreFeedPosts]);

  // Fetch discover posts (public posts)
  const fetchDiscoverPosts = useCallback(async () => {
    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .eq('privacy', 'everyone')
      .order('likes_count', { ascending: false })
      .limit(50);

    if (posts) {
      const postsWithUsers = await fetchPostsWithDetails(posts);
      setDiscoverPosts(postsWithUsers);
    }
  }, [userId]);

  // Fetch topics
  const fetchTopics = useCallback(async () => {
    const { data } = await supabase
      .from('discover_topics')
      .select('*')
      .order('is_trending', { ascending: false })
      .order('post_count', { ascending: false });

    if (data) {
      setTopics(data as Topic[]);
    }
  }, []);

  // Create post
  const createPost = useCallback(async (
    type: 'text' | 'photo' | 'video' | 'link',
    options: {
      content?: string;
      mediaFiles?: File[];
      location?: string;
      privacy?: 'everyone' | 'contacts' | 'close_friends' | 'only_me';
    }
  ) => {
    if (!userId) return null;

    const mediaUrls: string[] = [];

    if (options.mediaFiles?.length) {
      for (const originalFile of options.mediaFiles) {
        const file = await preparePostImage(originalFile);
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        console.log('[createPost] Uploading file:', file.name, 'size:', file.size, 'type:', file.type);

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, file, {
            cacheControl: '31536000',
            upsert: false,
          });

        if (uploadError) {
          console.error('[createPost] Upload error:', uploadError.message, uploadError);
          throw new Error(`Falha ao enviar ficheiro: ${uploadError.message}`);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(fileName);
          console.log('[createPost] Upload success, URL:', publicUrl);
          mediaUrls.push(publicUrl);
        }
      }
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        type,
        content: options.content,
        media_urls: mediaUrls,
        location: options.location,
        privacy: options.privacy || 'contacts',
      })
      .select()
      .single();

    if (error) {
      console.error('Create post error:', error);
      return null;
    }

    await fetchFeedPosts();
    return data;
  }, [userId, fetchFeedPosts]);

  // Delete post
  const deletePost = useCallback(async (postId: string) => {
    if (!userId) return;

    await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId);

    await fetchFeedPosts();
  }, [userId, fetchFeedPosts]);

  // Like/unlike post
  const toggleLike = useCallback(async (postId: string, reactionType: string = 'sankofa') => {
    if (!userId) return;

    const normalizedIncoming = normalizeReactionType(reactionType) || reactionType;

    const { data: existing } = await supabase
      .from('post_likes')
      .select('id, reaction_type')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    const existingNormalized = existing ? (normalizeReactionType(existing.reaction_type) || existing.reaction_type) : null;

    // Helper to update reaction counts
    const updateReactionCounts = (
      counts: ReactionCounts,
      oldType: string | null,
      newType: string | null
    ): ReactionCounts => {
      const updated = { ...counts };
      // Decrement old reaction
      if (oldType && oldType in updated) {
        updated[oldType as keyof ReactionCounts] = Math.max(0, updated[oldType as keyof ReactionCounts] - 1);
      }
      // Increment new reaction
      if (newType && newType in updated) {
        updated[newType as keyof ReactionCounts]++;
      }
      return updated;
    };

    if (existing) {
      // If same reaction, remove it (toggle off)
      if (existingNormalized === normalizedIncoming) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        // Update local state - removed reaction
        setFeedPosts(prev => prev.map(p =>
          p.id === postId
            ? {
                ...p,
                is_liked: false,
                my_reaction: null,
                likes_count: Math.max(0, p.likes_count - 1),
                reaction_counts: updateReactionCounts(p.reaction_counts, existingNormalized, null),
              }
            : p
        ));
        setDiscoverPosts(prev => prev.map(p =>
          p.id === postId
            ? {
                ...p,
                is_liked: false,
                my_reaction: null,
                likes_count: Math.max(0, p.likes_count - 1),
                reaction_counts: updateReactionCounts(p.reaction_counts, existingNormalized, null),
              }
            : p
        ));
      } else {
        // Different reaction, update it
        await supabase
          .from('post_likes')
          .update({ reaction_type: normalizedIncoming })
          .eq('post_id', postId)
          .eq('user_id', userId);

        // Update local state - changed reaction (decrement old, increment new)
        setFeedPosts(prev => prev.map(p =>
          p.id === postId
            ? {
                ...p,
                is_liked: true,
                my_reaction: normalizedIncoming,
                reaction_counts: updateReactionCounts(p.reaction_counts, existingNormalized, normalizedIncoming),
              }
            : p
        ));
        setDiscoverPosts(prev => prev.map(p =>
          p.id === postId
            ? {
                ...p,
                is_liked: true,
                my_reaction: normalizedIncoming,
                reaction_counts: updateReactionCounts(p.reaction_counts, existingNormalized, normalizedIncoming),
              }
            : p
        ));
      }
    } else {
      // No existing like, insert new one
      await supabase
        .from('post_likes')
        .insert({
          post_id: postId,
          user_id: userId,
          reaction_type: normalizedIncoming,
        });

      // Update local state - new reaction
      setFeedPosts(prev => prev.map(p =>
        p.id === postId
          ? {
              ...p,
              is_liked: true,
              my_reaction: normalizedIncoming,
              likes_count: p.likes_count + 1,
              reaction_counts: updateReactionCounts(p.reaction_counts, null, normalizedIncoming),
            }
          : p
      ));
      setDiscoverPosts(prev => prev.map(p =>
        p.id === postId
          ? {
              ...p,
              is_liked: true,
              my_reaction: normalizedIncoming,
              likes_count: p.likes_count + 1,
              reaction_counts: updateReactionCounts(p.reaction_counts, null, normalizedIncoming),
            }
          : p
      ));
    }
  }, [userId]);

  // Save/unsave post (optimistic update first, then DB)
  const toggleSave = useCallback(async (postId: string) => {
    if (!userId) return;

    // Optimistic: flip is_saved immediately so UI reacts instantly
    const flipSaved = (posts: PostWithUser[]) =>
      posts.map(p => p.id === postId ? { ...p, is_saved: !p.is_saved } : p);
    setFeedPosts(flipSaved);
    setDiscoverPosts(flipSaved);

    try {
      const { data: existing } = await supabase
        .from('saved_posts')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('saved_posts')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_posts')
          .insert({ post_id: postId, user_id: userId });
        if (error) throw error;
      }
    } catch (err) {
      console.error('toggleSave error:', err);
      // Revert on failure
      setFeedPosts(flipSaved);
      setDiscoverPosts(flipSaved);
    }
  }, [userId]);

  // Get comments for a post
  const getComments = useCallback(async (postId: string): Promise<Comment[]> => {
    const { data } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (!data || data.length === 0) return [];

    const commentIds = data.map(c => c.id);

    // Batch fetch all user profiles and reactions
    const userIds = [...new Set(data.map(c => c.user_id))];
    const [profilesResult, reactionsResult, myReactionsResult] = await Promise.all([
      fetchPublicProfilesBatched(userIds),
      supabase
        .from('comment_reactions')
        .select('comment_id, reaction_type')
        .in('comment_id', commentIds),
      userId ? supabase
        .from('comment_reactions')
        .select('comment_id, reaction_type')
        .in('comment_id', commentIds)
        .eq('user_id', userId) : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map(profilesResult.data?.map(p => [p.id, p]) || []);
    
    // Build reactions map per comment
    const reactionsMap = new Map<string, { [type: string]: number }>();
    reactionsResult.data?.forEach(r => {
      const existing = reactionsMap.get(r.comment_id) || {};
      existing[r.reaction_type] = (existing[r.reaction_type] || 0) + 1;
      reactionsMap.set(r.comment_id, existing);
    });

    // Build my reactions map
    const myReactionsMap = new Map<string, string>();
    myReactionsResult.data?.forEach(r => {
      myReactionsMap.set(r.comment_id, r.reaction_type);
    });

    const commentsWithUsers = data.map(comment => ({
      ...comment,
      user: profileMap.get(comment.user_id) || { 
        id: comment.user_id, 
        display_name: 'Unknown', 
        avatar_url: null, 
        username: '' 
      },
      reactions: reactionsMap.get(comment.id) || {},
      my_reaction: myReactionsMap.get(comment.id) || null,
    } as Comment));

    // Organize into threads
    const topLevel = commentsWithUsers.filter(c => !c.parent_comment_id);
    const replies = commentsWithUsers.filter(c => c.parent_comment_id);

    return topLevel.map(comment => ({
      ...comment,
      replies: replies.filter(r => r.parent_comment_id === comment.id),
    }));
  }, [userId]);

  // Add comment
  const addComment = useCallback(async (postId: string, content: string, parentCommentId?: string) => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content,
        parent_comment_id: parentCommentId,
      })
      .select()
      .single();

    if (error) {
      console.error('Add comment error:', error);
      return null;
    }

    // Update local comment count
    const updateCount = (posts: PostWithUser[]) =>
      posts.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p);

    setFeedPosts(updateCount);
    setDiscoverPosts(updateCount);

    return data;
  }, [userId]);

  // Delete comment
  const deleteComment = useCallback(async (commentId: string, postId: string) => {
    if (!userId) return;

    await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId);

    // Update local comment count
    const updateCount = (posts: PostWithUser[]) =>
      posts.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p);

    setFeedPosts(updateCount);
    setDiscoverPosts(updateCount);
  }, [userId]);

  // Toggle comment reaction
  const toggleCommentReaction = useCallback(async (commentId: string, reactionType: string) => {
    if (!userId) return { action: 'none' as const, reactionType: null };

    const { data: existing } = await supabase
      .from('comment_reactions')
      .select('id, reaction_type')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      if (existing.reaction_type === reactionType) {
        // Remove reaction
        await supabase
          .from('comment_reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);
        return { action: 'removed' as const, reactionType: null, previousType: existing.reaction_type };
      } else {
        // Update reaction
        await supabase
          .from('comment_reactions')
          .update({ reaction_type: reactionType })
          .eq('comment_id', commentId)
          .eq('user_id', userId);
        return { action: 'updated' as const, reactionType, previousType: existing.reaction_type };
      }
    } else {
      // Add new reaction
      await supabase
        .from('comment_reactions')
        .insert({
          comment_id: commentId,
          user_id: userId,
          reaction_type: reactionType,
        });
      return { action: 'added' as const, reactionType };
    }
  }, [userId]);

  // Update post
  const updatePost = useCallback(async (
    postId: string,
    updates: { content?: string; location?: string; privacy?: 'everyone' | 'contacts' | 'close_friends' | 'only_me' }
  ) => {
    if (!userId) return null;

    // Only include defined fields to avoid nullifying existing values
    const payload: Record<string, unknown> = {};
    if (updates.content !== undefined) payload.content = updates.content;
    if (updates.location !== undefined) payload.location = updates.location;
    if (updates.privacy !== undefined) payload.privacy = updates.privacy;

    const { data, error } = await supabase
      .from('posts')
      .update(payload)
      .eq('id', postId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update post error:', error);
      return null;
    }

    // Update local state
    const updateLocal = (posts: PostWithUser[]) =>
      posts.map(p => p.id === postId ? { ...p, ...updates } : p);
    setFeedPosts(updateLocal);
    setDiscoverPosts(updateLocal);

    return data;
  }, [userId]);

  // Share post
  const sharePost = useCallback(async (postId: string, shareType: 'repost' | 'quote' | 'message', quoteContent?: string) => {
    if (!userId) return;

    await supabase
      .from('post_shares')
      .insert({
        post_id: postId,
        user_id: userId,
        share_type: shareType,
        quote_content: quoteContent,
      });
  }, [userId]);

  // Get user posts
  const getUserPosts = useCallback(async (userId: string): Promise<PostWithUser[]> => {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!posts) return [];

    return fetchPostsWithDetails(posts);
  }, [userId]);

  // Get saved posts
  const getSavedPosts = useCallback(async (): Promise<PostWithUser[]> => {
    if (!userId) return [];

    const { data: saved } = await supabase
      .from('saved_posts')
      .select('post_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!saved?.length) return [];

    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .in('id', saved.map(s => s.post_id));

    if (!posts) return [];

    return fetchPostsWithDetails(posts);
  }, [userId]);

  // Get posts by topic
  const getPostsByTopic = useCallback(async (topicId: string): Promise<PostWithUser[]> => {
    // Fetch post IDs associated with this topic
    const { data: postTopics } = await supabase
      .from('post_topics')
      .select('post_id')
      .eq('topic_id', topicId);

    if (!postTopics?.length) return [];

    const postIds = postTopics.map(pt => pt.post_id);

    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .in('id', postIds)
      .eq('privacy', 'everyone')
      .order('likes_count', { ascending: false })
      .limit(50);

    if (!posts) return [];

    return fetchPostsWithDetails(posts);
  }, [userId]);

  // A different account must never inherit posts or late responses from the old one.
  useEffect(() => {
    setFeedPosts([]);
    setDiscoverPosts([]);
    setNewPostsCount(0);
    setLoading(Boolean(userId));
    setFeedError(false);
    setLoadMoreError(false);
    setHasMoreFeed(true);
    feedCursorRef.current = null;
    contactIdsRef.current = [];
    newestCreatedAtRef.current = null;
    realtimeVersionsRef.current.clear();
    paginationFailedRef.current = false;
    loadingMoreRef.current = false;
    setLoadingMoreFeed(false);
    return () => {
      ++feedGenerationRef.current;
      pendingFeedRef.current = null;
    };
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (!autoLoad) return;
    fetchFeedPosts();
    if (loadDiscovery) {
      fetchDiscoverPosts();
      fetchTopics();
    }
  }, [autoLoad, loadDiscovery, fetchFeedPosts, fetchDiscoverPosts, fetchTopics]);

  // Realtime subscription
  useEffect(() => {
    if (!autoLoad) return;
    const channel = supabase
      .channel(`posts-updates-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload: RealtimePostgresChangesPayload<Tables<'posts'>>) => {
          // A qualifying new post from any author → surface a "new posts" pill
          // instead of silently replacing the feed (keeps the scroll position).
          if (payload.eventType === 'INSERT') {
            const p = payload.new;
            const qualifies = p.privacy === 'everyone' || contactIdsRef.current.includes(p.user_id);
            const isNewer = !newestCreatedAtRef.current || p.created_at > newestCreatedAtRef.current;
            if (qualifies && isNewer) {
              setNewPostsCount(c => c + 1);
              if (loadDiscovery) fetchDiscoverPosts();
              return;
            }
          }
          // Apply changes in place. Refetching page one here can remove the
          // post being read and discard pages loaded by infinite scrolling.
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            const version = (realtimeVersionsRef.current.get(updated.id) ?? 0) + 1;
            realtimeVersionsRef.current.set(updated.id, version);
            const generation = feedGenerationRef.current;
            const existing = feedPostsRef.current.find(post => post.id === updated.id);
            setFeedPosts(previous => previous.flatMap(post => {
              if (post.id !== updated.id) return [post];
              // Remove another author's post if its audience changes; only a
              // subsequent authorized fetch may make it visible again.
              if (updated.user_id !== userId && updated.privacy !== post.privacy) return [];
              return [{ ...post, ...updated, type: updated.type as PostWithUser['type'],
                privacy: updated.privacy as PostWithUser['privacy'], media_urls: updated.media_urls || [] }];
            }));
            // Refresh reactions/bookmarks for this card only, without replacing
            // the list. A later event or refresh invalidates this enrichment.
            if (existing && (updated.user_id === userId || updated.privacy === existing.privacy)) {
              void fetchPostsWithDetails([updated]).then(([detailed]) => {
                if (!detailed || feedGenerationRef.current !== generation ||
                    realtimeVersionsRef.current.get(updated.id) !== version) return;
                setFeedPosts(previous => previous.map(post => post.id === updated.id ? detailed : post));
              }).catch(error => console.error('Unable to update post details', error));
            }
          } else if (payload.eventType === 'DELETE') {
            const id = payload.old.id;
            if (id) realtimeVersionsRef.current.set(id, (realtimeVersionsRef.current.get(id) ?? 0) + 1);
            setFeedPosts(previous => previous.filter(post => post.id !== payload.old.id));
          }
          if (loadDiscovery) fetchDiscoverPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autoLoad, loadDiscovery, userId, fetchFeedPosts, fetchDiscoverPosts]);

  return {
    feedPosts,
    discoverPosts,
    topics,
    loading,
    feedError,
    loadMoreError,
    retryLoadMorePosts,
    createPost,
    updatePost,
    deletePost,
    toggleLike,
    toggleSave,
    getComments,
    addComment,
    deleteComment,
    toggleCommentReaction,
    sharePost,
    getUserPosts,
    getSavedPosts,
    getPostsByTopic,
    fetchFeedPosts,
    fetchDiscoverPosts,
    loadMoreFeedPosts,
    hasMoreFeed,
    loadingMoreFeed,
    newPostsCount,
  };
}
