import { deleteChatMessage } from '@/lib/delete-chat-message';
import { createChatConversation } from '@/lib/chat-conversations';
import { useMessageExpiry } from './useMessageExpiry';
import { orderConversations } from '@/lib/chat-conversations';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchPublicProfileById, fetchPublicProfilesBatched } from '@/lib/public-profile-batch';
import { useAuth } from './useAuth';
import { useMessageNotification } from './useMessageNotification';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';

// Subset of the `public_profiles` view columns this hook selects.
interface PublicProfile {
  id: string | null;
  display_name: string | null;
  username?: string | null;
  avatar_url: string | null;
  is_online?: boolean | null;
  last_seen?: string | null;
}

function messageProfile(profile?: PublicProfile): Message['sender_profile'] {
  if (!profile?.id) return undefined;
  return {
    id: profile.id,
    display_name: profile.display_name || 'Utilizador',
    username: profile.username || '',
    avatar_url: profile.avatar_url,
  };
}

interface Message {
  expires_at?: string | null;
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  thumbnail_url?: string | null;
  reply_to_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  is_view_once?: boolean;
  created_at: string;
  updated_at: string;
  duration_seconds?: number;
  delivered_at?: string | null;
  read_by?: unknown;
  sender_profile?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  reply_to?: {
    id: string;
    content: string | null;
    message_type: string;
    sender_profile?: {
      display_name: string;
      avatar_url: string | null;
    };
  };
}

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface Conversation {
  id: string;
  type: string;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  participants?: {
    user_id: string;
    profile?: {
      id: string;
      display_name: string;
      username: string;
      avatar_url: string | null;
      is_online: boolean;
      last_seen: string | null;
    };
  }[];
  last_message?: Message;
  unread_count?: number;
  // is_pinned/is_muted live on the current user's conversation_participants row
  // (not on conversations); useConversations merges them into each object.
  is_pinned?: boolean | null;
  is_muted?: boolean | null;
}

interface TypingUser {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Unique per hook instance so concurrent mounts don't collide on the same
  // Supabase realtime channel topic (which throws "cannot add postgres_changes
  // callbacks ... after subscribe()").
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`conversation-presence-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profile_presence' }, (payload) => {
        const profile = payload.new as PublicProfile;
        setConversations(previous => previous.map(conversation => ({ ...conversation,
          participants: (conversation.participants ?? []).map(participant => participant.profile?.id === profile.id
            ? { ...participant, profile: { ...participant.profile, is_online: profile.is_online ?? false, last_seen: profile.last_seen ?? null } } : participant),
        })));
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, is_archived')
        .eq('user_id', user.id);

      if (partError) throw partError;

      // Excluir conversas que o utilizador arquivou — essas aparecem apenas no
      // ArchivedChatsSheet, não na lista principal.
      const conversationIds = (participations || [])
        .filter((p) => !p.is_archived)
        .map((p) => p.conversation_id);
      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Fetch conversations, all participants, last messages, and user's participation in parallel
      const [conversationsResult, allParticipantsResult, lastMessagesResult, userParticipationsResult] = await Promise.all([
        supabase
          .from('conversations')
          .select('*')
          .in('id', conversationIds)
          .order('updated_at', { ascending: false }),
        supabase
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', conversationIds),
        supabase
          .from('visible_messages')
          .select('*')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('conversation_participants')
          .select('conversation_id, last_read_at, is_pinned, is_muted')
          .eq('user_id', user.id)
          .in('conversation_id', conversationIds)
      ]);

      for (const result of [conversationsResult, allParticipantsResult, lastMessagesResult, userParticipationsResult]) {
        if (result.error) throw result.error;
      }
      const conversationsData = conversationsResult.data || [];
      const allParticipants = allParticipantsResult.data || [];
      const allMessages = lastMessagesResult.data || [];
      const userParticipations = userParticipationsResult.data || [];

      // Get unique participant user IDs and fetch all profiles
      const participantUserIds = [...new Set(allParticipants.map(p => p.user_id))];
      const { data: profiles } = await fetchPublicProfilesBatched(participantUserIds);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      // Group participants by conversation
      const participantsByConv = new Map<string, { user_id: string; profile?: typeof profiles[0] }[]>();
      allParticipants.forEach(p => {
        if (!participantsByConv.has(p.conversation_id)) {
          participantsByConv.set(p.conversation_id, []);
        }
        participantsByConv.get(p.conversation_id)!.push({
          user_id: p.user_id,
          profile: profileMap.get(p.user_id),
        });
      });

      // Get last message per conversation
      const lastMessageByConv = new Map<string, typeof allMessages[0]>();
      allMessages.forEach(msg => {
        if (!lastMessageByConv.has(msg.conversation_id)) {
          lastMessageByConv.set(msg.conversation_id, msg);
        }
      });

      // Get user's last_read_at + pin/mute state per conversation (these live on
      // the current user's conversation_participants row, not on conversations).
      const lastReadByConv = new Map<string, string | null>();
      const pinnedByConv = new Map<string, boolean>();
      const mutedByConv = new Map<string, boolean>();
      userParticipations.forEach(p => {
        lastReadByConv.set(p.conversation_id, p.last_read_at);
        pinnedByConv.set(p.conversation_id, p.is_pinned ?? false);
        mutedByConv.set(p.conversation_id, p.is_muted ?? false);
      });

      // Calculate unread counts
      const unreadCounts = new Map<string, number>();
      conversationIds.forEach(convId => {
        const lastRead = lastReadByConv.get(convId);
        let count = 0;
        allMessages.forEach(msg => {
          if (msg.conversation_id === convId && msg.sender_id !== user.id && !msg.is_deleted) {
            if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
              count++;
            }
          }
        });
        unreadCounts.set(convId, count);
      });

      const enrichedConversations = conversationsData.map(conv => ({
        ...conv,
        participants: participantsByConv.get(conv.id) || [],
        last_message: lastMessageByConv.get(conv.id),
        unread_count: unreadCounts.get(conv.id) || 0,
        is_pinned: pinnedByConv.get(conv.id) ?? false,
        is_muted: mutedByConv.get(conv.id) ?? false,
      }));

      setConversations(orderConversations(enrichedConversations, user.id));
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();

    if (user) {
      channelRef.current = supabase
        .channel(`conversations-updates-${instanceIdRef.current}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${user.id}` }, () => { void fetchConversations(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
          fetchConversations();
        })
        .subscribe();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchConversations, user]);

  const createConversation = async (
    participantIds: string[],
    groupName?: string,
    groupAvatarUrl?: string | null
  ) => {
    if (!user) return { error: new Error('Not authenticated'), data: null };

    const { data: newConv, error } = await createChatConversation(participantIds, groupName, groupAvatarUrl);
    if (error) return { error, data: null };

    await fetchConversations();
    return { error: null, data: newConv };
  };

  return { conversations, loading, refresh: fetchConversations, createConversation };
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const { notifyMessage } = useMessageNotification();
  const [messages, setMessages] = useState<Message[]>([]);
  const unexpiredMessages = useMessageExpiry(messages);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [viewOnceViewedIds, setViewOnceViewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Unique per hook instance to avoid realtime channel-topic collisions when
  // multiple components subscribe to the same conversation concurrently.
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingChannelReadyRef = useRef(false);
  const typingPendingRef = useRef(false); // queued typing event to send on reconnect
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingLastSentRef = useRef<number>(0);
  const historyCutoffRef = useRef<string | null>(null);
  const [historyClearedAt, setHistoryClearedAt] = useState<string | null>(null);
  const typingProfileCacheRef = useRef<Map<string, { display_name: string; avatar_url: string | null }>>(new Map());
  // Per-user timeouts to auto-clear stale typing states
  const typingUserTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const fetchMessages = useCallback(async (markRead = true) => {
    if (!conversationId || !user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      const { data: participation, error: participationError } = await supabase
        .from('conversation_participants')
        .select('history_cleared_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .single();
      if (participationError) throw participationError;
      historyCutoffRef.current = participation.history_cleared_at;
      setHistoryClearedAt(participation.history_cleared_at);
      const { data: messagesData, error } = await supabase
        .from('visible_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        // Hide disappearing messages that have already expired (the cron purges
        // them from the DB shortly after; this keeps them out of view meanwhile).
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!messagesData?.length) {
        setMessages([]);
        setReactions({});
        setStarredIds(new Set());
        setPinnedIds(new Set());
        setLoading(false);
        return;
      }

      const messageIds = messagesData.map(m => m.id);
      const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
      const replyToIds = messagesData.filter(m => m.reply_to_id).map(m => m.reply_to_id!);

      // Batch fetch profiles, reactions, starred, pinned, reply messages, and view-once views in parallel
      const [profilesResult, reactionsResult, starredResult, pinnedResult, replyMessagesResult, viewOnceResult] = await Promise.all([
        fetchPublicProfilesBatched(senderIds),
        supabase
          .from('message_reactions')
          .select('*')
          .in('message_id', messageIds),
        supabase
          .from('starred_messages')
          .select('message_id')
          .eq('user_id', user.id)
          .in('message_id', messageIds),
        supabase
          .from('pinned_messages')
          .select('message_id')
          .eq('conversation_id', conversationId),
        replyToIds.length > 0
          ? supabase
              .from('visible_messages')
              .select('id, content, message_type, sender_id')
              .in('id', replyToIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('view_once_views')
          .select('message_id')
          .eq('user_id', user.id)
          .in('message_id', messageIds),
      ]);

      const profileMap = new Map<string | null, PublicProfile>((profilesResult.data ?? []).map((p) => [p.id, p]));
      const replyMessages = replyMessagesResult.data || [];
      const replyMessageMap = new Map(replyMessages.map(m => [m.id, m]));

      // Fetch profiles for reply senders if not already fetched
      const replySenderIds = [...new Set(replyMessages.map(m => m.sender_id).filter(id => !profileMap.has(id)))];
      if (replySenderIds.length > 0) {
        const { data: replyProfiles } = await fetchPublicProfilesBatched(replySenderIds);
        (replyProfiles ?? []).forEach((p) => profileMap.set(p.id, p));
      }

      // Build messages with profiles
      const messagesWithProfiles = messagesData.map(msg => {
        let replyTo = undefined;
        if (msg.reply_to_id) {
          const replyMsg = replyMessageMap.get(msg.reply_to_id);
          if (replyMsg) {
            const replyProfile = profileMap.get(replyMsg.sender_id);
            replyTo = { ...replyMsg, sender_profile: messageProfile(replyProfile) };
          }
        }
        return {
          ...msg,
          sender_profile: messageProfile(profileMap.get(msg.sender_id)),
          reply_to: replyTo,
        };
      });

      // Merge server messages with any local optimistic state (e.g. keep local blob: URL until upload finishes)
      setMessages((prev) => {
        const prevById = new Map(prev.map((m) => [m.id, m] as const));

        return messagesWithProfiles.map((m) => {
          const prevMsg = prevById.get(m.id);
          if (!prevMsg) return m;

          const prevMedia = typeof prevMsg.media_url === 'string' ? prevMsg.media_url : null;
          const keepLocalBlob =
            (!m.media_url || m.media_url === '') &&
            !!prevMedia &&
            prevMedia.startsWith('blob:') &&
            m.message_type === 'voice';

          return {
            ...m,
            media_url: keepLocalBlob ? prevMedia : m.media_url,
            // keep any enriched fields if they exist
            sender_profile: m.sender_profile ?? prevMsg.sender_profile,
            reply_to: m.reply_to ?? prevMsg.reply_to,
          };
        });
      });

      // Build reactions map
      const reactionsMap: Record<string, Reaction[]> = {};
      (reactionsResult.data || []).forEach((r) => {
        if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
        const existing = reactionsMap[r.message_id].find((e) => e.emoji === r.emoji);
        if (existing) {
          existing.count++;
          existing.users.push(r.user_id);
        } else {
          reactionsMap[r.message_id].push({ emoji: r.emoji, count: 1, users: [r.user_id] });
        }
      });
      setReactions(reactionsMap);

      setStarredIds(new Set((starredResult.data || []).map((s) => s.message_id)));
      setPinnedIds(new Set((pinnedResult.data || []).map((p) => p.message_id)));
      setViewOnceViewedIds(new Set((viewOnceResult.data || []).map((v) => v.message_id)));

      // Mark as read — only on an explicit open/refresh, not on incidental
      // refetches (e.g. a reaction elsewhere), which would wrongly clear the
      // unread badge.
      if (markRead) {
        await supabase
          .from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

  useEffect(() => {
    historyCutoffRef.current = null;
    setHistoryClearedAt(null);
    fetchMessages();

    if (conversationId && user) {
      channelRef.current = supabase
        .channel(`messages-${conversationId}-${instanceIdRef.current}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${conversationId}` }, payload => {
          if ((payload.new as { user_id?: string }).user_id === user.id) void fetchMessages(false);
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, async (payload: RealtimePostgresChangesPayload<Tables<'messages'>>) => {
          const newMessage = payload.new as Message;
          if (historyCutoffRef.current && newMessage.created_at <= historyCutoffRef.current) return;

          // For own messages, merge by id (we generate the UUID client-side for optimistic messages)
          if (newMessage.sender_id === user.id) {
            setMessages((prev) => {
              // 1) Preferred: merge by id (no duplicates)
              const alreadyExists = prev.some((m) => m.id === newMessage.id);
              if (alreadyExists) {
                return prev.map((m) => {
                  if (m.id !== newMessage.id) return m;

                  const prevMedia = typeof m.media_url === 'string' ? m.media_url : null;
                  const nextMedia = typeof newMessage.media_url === 'string' ? newMessage.media_url : null;
                  const keepLocalBlob = (!nextMedia || nextMedia === '') && !!prevMedia && prevMedia.startsWith('blob:');

                  return {
                    ...m,
                    ...newMessage,
                    media_url: keepLocalBlob ? prevMedia : nextMedia,
                    sender_profile: m.sender_profile,
                    reply_to: m.reply_to,
                  };
                });
              }

              // 2) No id match → append. There is deliberately no content-based
              // fallback: optimistic messages always carry a client UUID (see
              // sendMessage), so matching two same-text messages by content could
              // replace the wrong one.
              return [
                ...prev,
                {
                  ...newMessage,
                  sender_profile: {
                    id: user.id,
                    display_name: user.user_metadata?.display_name || 'You',
                    username: user.user_metadata?.username || '',
                    avatar_url: user.user_metadata?.avatar_url || null,
                  },
                },
              ];
            });
            return;
          }
          
          // For other users' messages, fetch profile (non-blocking pattern)
          const { data: profile } = await fetchPublicProfileById(newMessage.sender_id);

          setMessages((prev) => prev.some(message => message.id === newMessage.id)
            ? prev
            : [...prev, { ...newMessage, sender_profile: messageProfile(profile) }]);

          // Trigger notification sound/vibration for incoming messages
          notifyMessage();

          // Mark as read in background AND update message read_by
          void supabase
            .from('conversation_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', user.id);

          // Append this reader to read_by atomically (server-side jsonb append,
          // de-duplicated) so group receipts accumulate and the value stays a
          // real array the UI can read.
          void supabase.rpc('mark_message_read', { p_message_id: newMessage.id });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload: RealtimePostgresChangesPayload<Tables<'messages'>>) => {
          const updatedMessage = payload.new as Message;
          // Merge all updated fields (e.g. media_url after voice upload), but keep enriched joins
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== updatedMessage.id) return m;

              const prevMedia = typeof m.media_url === 'string' ? m.media_url : null;
              const nextMedia = typeof updatedMessage.media_url === 'string' ? updatedMessage.media_url : null;
              const keepLocalBlob = (!nextMedia || nextMedia === '') && !!prevMedia && prevMedia.startsWith('blob:');

              return {
                ...m,
                ...updatedMessage,
                media_url: keepLocalBlob ? prevMedia : updatedMessage.media_url,
                sender_profile: m.sender_profile,
                reply_to: m.reply_to,
              };
            })
          );
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        }, () => {
          fetchMessages(false);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        }, async (payload: RealtimePostgresChangesPayload<Tables<'typing_indicators'>>) => {
          // REPLICA IDENTITY FULL ensures payload.new has all columns on UPDATE/DELETE
          const eventType = payload.eventType;
          // For DELETE events, the data is in payload.old; for INSERT/UPDATE it's in payload.new
          const row = (eventType === 'DELETE'
            ? payload.old
            : payload.new) as { user_id?: string; updated_at?: string } | null;

          if (!row?.user_id || row.user_id === user.id) return;

          const typingUserId = row.user_id;
          const now = Date.now();
          const fiveSecondsAgo = now - 5000;

          // Fetch profile if not cached (before updating state)
          if (!typingProfileCacheRef.current.has(typingUserId) && eventType !== 'DELETE') {
            const { data } = await fetchPublicProfileById(typingUserId);
            typingProfileCacheRef.current.set(typingUserId, {
              display_name: data?.display_name || 'User',
              avatar_url: data?.avatar_url ?? null,
            });
          }

          setTypingUsers((prev) => {
            // Preserve existing timestamps correctly
            const prevMap = new Map<string, number>(
              prev.map((u) => [u.user_id, (u as TypingUser & { _ts?: number })._ts ?? now])
            );

            if (eventType === 'DELETE') {
              prevMap.delete(typingUserId);
            } else {
              const ts = row.updated_at ? new Date(row.updated_at).getTime() : now;
              if (ts >= fiveSecondsAgo) {
                prevMap.set(typingUserId, ts);
              }
            }

            // Prune stale entries
            for (const [id, ts] of prevMap.entries()) {
              if (ts < fiveSecondsAgo) prevMap.delete(id);
            }

            return Array.from(prevMap.entries()).map(([id, ts]) => {
              const cached = typingProfileCacheRef.current.get(id);
              return {
                user_id: id,
                display_name: cached?.display_name || 'User',
                avatar_url: cached?.avatar_url ?? null,
                _ts: ts,
              } as TypingUser & { _ts: number };
            });
          });
        })
        .subscribe();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, fetchMessages, user?.id]);

  // --- Broadcast-based typing indicator (low-latency, no WAL delay) ---
  useEffect(() => {
    if (!conversationId || !user) return;

    typingChannelReadyRef.current = false;

    const channel = supabase
      .channel(`typing-broadcast-${conversationId}`, {
        config: { broadcast: { self: false, ack: false } },
      })
      .on('broadcast', { event: 'typing' }, async (payload: { payload?: { user_id?: string; display_name?: string; avatar_url?: string | null } }) => {
        const typingUserId = payload.payload?.user_id;
        if (!typingUserId || typingUserId === user.id) return;

        console.log('[Typing] Received typing broadcast from:', typingUserId);

        // Cache profile if not already present
        if (!typingProfileCacheRef.current.has(typingUserId)) {
          const displayName = payload.payload?.display_name;
          const avatarUrl = payload.payload?.avatar_url ?? null;
          if (displayName) {
            typingProfileCacheRef.current.set(typingUserId, { display_name: displayName, avatar_url: avatarUrl });
          } else {
            const { data } = await fetchPublicProfileById(typingUserId);
            typingProfileCacheRef.current.set(typingUserId, {
              display_name: data?.display_name || 'User',
              avatar_url: data?.avatar_url ?? null,
            });
          }
        }

        const cached = typingProfileCacheRef.current.get(typingUserId);

        // Add/refresh user in typing list
        setTypingUsers((prev) => {
          const without = prev.filter((u) => u.user_id !== typingUserId);
          return [
            ...without,
            {
              user_id: typingUserId,
              display_name: cached?.display_name || payload.payload?.display_name || 'User',
              avatar_url: cached?.avatar_url ?? payload.payload?.avatar_url ?? null,
            },
          ];
        });

        // Auto-clear this user after 4 seconds of no new events
        const existing = typingUserTimeoutsRef.current.get(typingUserId);
        if (existing) clearTimeout(existing);
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.user_id !== typingUserId));
          typingUserTimeoutsRef.current.delete(typingUserId);
        }, 4000);
        typingUserTimeoutsRef.current.set(typingUserId, timeout);
      })
      .on('broadcast', { event: 'stopped_typing' }, (payload: { payload?: { user_id?: string } }) => {
        const stoppedUserId = payload.payload?.user_id;
        if (!stoppedUserId) return;
        console.log('[Typing] Received stopped_typing from:', stoppedUserId);
        setTypingUsers((prev) => prev.filter((u) => u.user_id !== stoppedUserId));
        const t = typingUserTimeoutsRef.current.get(stoppedUserId);
        if (t) { clearTimeout(t); typingUserTimeoutsRef.current.delete(stoppedUserId); }
      })
      .subscribe((status) => {
        typingChannelReadyRef.current = status === 'SUBSCRIBED';

        // Flush any queued typing event now that the channel is joined
        if (status === 'SUBSCRIBED' && typingPendingRef.current && user) {
          typingPendingRef.current = false;
          channel.send({
            type: 'broadcast',
            event: 'typing',
            payload: {
              user_id: user.id,
              display_name: user.user_metadata?.display_name || 'User',
              avatar_url: user.user_metadata?.avatar_url || null,
            },
          });
        }
      });

    typingChannelRef.current = channel;

    return () => {
      typingChannelReadyRef.current = false;
      typingPendingRef.current = false;
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
      // Clear all typing user timeouts
      typingUserTimeoutsRef.current.forEach((t) => clearTimeout(t));
      typingUserTimeoutsRef.current.clear();
      setTypingUsers([]);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id]);

  const sendMessage = async (
    content: string,
    messageType: string = 'text',
    mediaUrl?: string,
    replyToId?: string,
    durationSeconds?: number,
    isViewOnce?: boolean,
    thumbnailUrl?: string
  ): Promise<{ error: Error | null; messageId?: string }> => {
    if (!conversationId || !user) return { error: new Error('Invalid') };

    // Optimistic update - add message immediately to UI
    // NOTE: We generate the real UUID client-side so we can reliably update the row later
    // (e.g. after an async voice upload) without depending on INSERT returning the row.
    const createUuid = (): string => {
      // Prefer native randomUUID
      if (typeof crypto !== 'undefined' && typeof (crypto as Crypto).randomUUID === 'function') {
        return (crypto as Crypto).randomUUID();
      }

      // Fallback (RFC4122 v4) using getRandomValues
      if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
        throw new Error('Crypto API not available');
      }

      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // Version 4
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      // Variant 10xx
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };

    const messageId = createUuid();

    const optimisticMessage: Message = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: content || null,
      message_type: messageType,
      // Keep blob: URL only in UI for immediate feedback (never persist it)
      media_url: mediaUrl || null,
      thumbnail_url: thumbnailUrl || null,
      reply_to_id: replyToId || null,
      is_edited: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      is_view_once: isViewOnce || false,
      sender_profile: {
        id: user.id,
        display_name: user.user_metadata?.display_name || 'You',
        username: user.user_metadata?.username || '',
        avatar_url: user.user_metadata?.avatar_url || null,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const isBlobUrl = !!mediaUrl && mediaUrl.startsWith('blob:');
    const dbMediaUrl = isBlobUrl ? null : (mediaUrl || null);

    const { error } = await supabase
      .from('messages')
      .insert({
        id: messageId,
        conversation_id: conversationId,
        sender_id: user.id,
        content: content || null,
        message_type: messageType,
        media_url: dbMediaUrl,
        thumbnail_url: thumbnailUrl || null,
        reply_to_id: replyToId || null,
        duration_seconds: durationSeconds || null,
        is_view_once: isViewOnce || false,
      });

    // Clear typing indicator via broadcast (immediate) 
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'stopped_typing',
        payload: { user_id: user.id },
      });
    }


    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      return { error: new Error(error.message) };
    }

    return { error: null, messageId };
  };

  const updateMessageMediaUrl = async (messageId: string, newMediaUrl: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('messages')
      .update({ media_url: newMediaUrl })
      .eq('id', messageId)
      .eq('sender_id', user.id);

    if (!error) {
      // Update local state
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, media_url: newMediaUrl } : m)));
    }

    return { error: error ? new Error(error.message) : null };
  };

  const editMessage = async (messageId: string, newContent: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    // Get the original message
    const message = messages.find((m) => m.id === messageId);
    if (!message || message.sender_id !== user.id) {
      return { error: new Error('Cannot edit this message') };
    }

    // Check 15-minute window
    const createdAt = new Date(message.created_at).getTime();
    const now = Date.now();
    if (now - createdAt > 15 * 60 * 1000) {
      return { error: new Error('Edit window expired') };
    }

    // Save original content to edit history
    await supabase.from('message_edits').insert({
      message_id: messageId,
      original_content: message.content || '',
    });

    // Update the message
    const { error } = await supabase
      .from('messages')
      .update({
        content: newContent,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('sender_id', user.id);

    if (!error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: newContent, is_edited: true } : m
        )
      );
    }

    return { error: error ? new Error(error.message) : null };
  };

  const forwardMessage = async (messageId: string, conversationIds: string[]) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase.rpc('forward_chat_messages', {
      p_message_ids: [messageId],
      p_conversation_ids: conversationIds,
    });
    return { error: error ? new Error(error.message) : null };
  };

  // Typing indicator - uses Realtime Broadcast for immediate feedback (no WAL latency)
  // Also respects user's show_typing_indicators privacy setting
  const setTyping = async (userShowTypingIndicators: boolean = true) => {
    if (!conversationId || !user) return;
    
    // If user has disabled typing indicators, don't broadcast
    if (!userShowTypingIndicators) return;

    // Throttle: at most once every 800ms
    const now = Date.now();
    if (now - typingLastSentRef.current < 800) return;
    typingLastSentRef.current = now;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Check the channel's actual socket state directly — avoids stale-ref issues caused by
    // React StrictMode double-invoking cleanup (which resets typingChannelReadyRef to false
    // even after the channel has already joined).
    const ch = typingChannelRef.current;
    const isJoined = ch && ch.state === 'joined';

    if (isJoined) {
      ch.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: user.id,
          display_name: user.user_metadata?.display_name || 'User',
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      });
      typingPendingRef.current = false;
    } else {
      // Channel still connecting — queue so the subscribe-flush sends it
      typingPendingRef.current = true;
    }

    // Schedule "stopped typing" broadcast after 5s of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      const chNow = typingChannelRef.current;
      const joinedNow = chNow && chNow.state === 'joined';
      if (joinedNow) {
        chNow.send({
          type: 'broadcast',
          event: 'stopped_typing',
          payload: { user_id: user.id },
        });
      }
      typingPendingRef.current = false;
    }, 5000);
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await deleteChatMessage(messageId, user.id);

    if (!error) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, is_deleted: true, content: null } : m)));
    }
    return { error: error ? new Error(error.message) : null };
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    // Check if user already reacted with this specific emoji
    const existingWithSameEmoji = reactions[messageId]?.find((r) => r.emoji === emoji && r.users.includes(user.id));

    if (existingWithSameEmoji) {
      // User clicked same reaction - remove it (toggle off)
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
    } else {
      // Remove any existing reactions from this user on this message first
      // This ensures only ONE reaction per user per message
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id);

      // Then add the new reaction
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji });
    }

    return { error: null };
  };

  const toggleStar = async (messageId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    if (starredIds.has(messageId)) {
      await supabase.from('starred_messages').delete().eq('message_id', messageId).eq('user_id', user.id);
      setStarredIds((prev) => { const next = new Set(prev); next.delete(messageId); return next; });
    } else {
      await supabase.from('starred_messages').insert({ message_id: messageId, user_id: user.id });
      setStarredIds((prev) => new Set(prev).add(messageId));
    }

    return { error: null };
  };

  const togglePin = async (messageId: string) => {
    if (!user || !conversationId) return { error: new Error('Not authenticated') };

    if (pinnedIds.has(messageId)) {
      await supabase.from('pinned_messages').delete().eq('message_id', messageId).eq('conversation_id', conversationId);
      setPinnedIds((prev) => { const next = new Set(prev); next.delete(messageId); return next; });
    } else {
      await supabase.from('pinned_messages').insert({ message_id: messageId, conversation_id: conversationId, pinned_by: user.id });
      setPinnedIds((prev) => new Set(prev).add(messageId));
    }

    return { error: null };
  };

  const searchMessages = async (query: string) => {
    if (!conversationId || !query.trim()) return [];

    const { data } = await supabase
      .from('visible_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    return data || [];
  };

  const markViewOnce = async (messageId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    // Upsert so calling twice never throws a duplicate-key error
    const { error } = await supabase
      .from('view_once_views')
      .upsert(
        { message_id: messageId, user_id: user.id, viewed_at: new Date().toISOString() },
        { onConflict: 'message_id,user_id', ignoreDuplicates: true }
      );

    // Always update local state (even if the DB row already existed)
    setViewOnceViewedIds((prev) => new Set(prev).add(messageId));

    return { error: error ? new Error(error.message) : null };
  };

  const setHistoryCleared = async (restore = false) => {
    if (!conversationId) throw new Error('Conversa indisponível');
    const { data, error } = await supabase.rpc('set_chat_history_cleared', {
      p_conversation_id: conversationId,
      p_restore: restore,
    });
    if (error) throw error;
    historyCutoffRef.current = data;
    setHistoryClearedAt(data);
    if (data) setMessages(previous => previous.filter(message => message.created_at > data));
    await fetchMessages(false);
  };

  return {
    historyClearedAt, setHistoryCleared,
    messages: unexpiredMessages,
    reactions,
    starredIds,
    pinnedIds,
    viewOnceViewedIds,
    loading,
    typingUsers,
    sendMessage,
    updateMessageMediaUrl,
    setTyping,
    deleteMessage,
    editMessage,
    forwardMessage,
    toggleReaction,
    toggleStar,
    togglePin,
    searchMessages,
    markViewOnce,
    refresh: fetchMessages,
  };
}
