import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMessageNotification } from '@/hooks/useMessageNotification';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';
import { useLocation } from 'react-router-dom';

/**
 * Global component that listens for new messages AND typing indicators
 * across ALL conversations the user participates in, and triggers
 * notification sound/vibration even when not viewing that specific chat.
 */
export function GlobalMessageNotifier() {
  const location = useLocation();
  const { user } = useAuth();
  const { notifyMessage, triggerVibration } = useMessageNotification();
  const messageChannelRef = useRef<RealtimeChannel | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const participatingConversationsRef = useRef<Set<string>>(new Set());
  // Único por instância para não colidir no mesmo tópico do canal realtime.
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  // Track which conversations the user is currently viewing
  // to avoid notifying when already watching the typing happen
  const currentPathRef = useRef(location.pathname);
  currentPathRef.current = location.pathname;

  // Soft typing notification: gentle haptic only (no sound — would be annoying)
  const notifyTyping = useCallback(() => {
    triggerVibration('reaction'); // [50ms] — subtle
  }, [triggerVibration]);

  const isViewingConversation = useCallback((conversationId: string) => {
    return currentPathRef.current.includes(conversationId);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch all conversation IDs the user participates in
    const fetchConversations = async () => {
      const { data } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (data) {
        participatingConversationsRef.current = new Set(data.map(d => d.conversation_id));
      }
    };

    fetchConversations();

    // ── 1. Listen for new messages ──────────────────────────────
    const messageChannel = supabase
      .channel(`global-message-notifications-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as { sender_id: string; conversation_id: string };

          // Only notify for messages from OTHER users, in conversations we participate in,
          // AND only when we are NOT already viewing that conversation
          if (
            newMessage.sender_id !== user.id &&
            participatingConversationsRef.current.has(newMessage.conversation_id) &&
            !isViewingConversation(newMessage.conversation_id)
          ) {
            notifyMessage();
          }
        }
      )
      .subscribe();

    messageChannelRef.current = messageChannel;

    // ── 2. Listen for typing indicators ────────────────────────
    // We listen to both INSERT and UPDATE because upsert generates UPDATE
    // when the record already exists (same user typing again).
    const handleTypingEvent = (payload: RealtimePostgresChangesPayload<Tables<'typing_indicators'>>) => {
      const indicator = ('new' in payload ? payload.new : null) || ('old' in payload ? payload.old : null);
      const userId = (indicator as Partial<Tables<'typing_indicators'>> | null)?.user_id;
      const conversationId = (indicator as Partial<Tables<'typing_indicators'>> | null)?.conversation_id;
      if (!userId || !conversationId) return;

      // Only notify if:
      // - The typer is someone else
      // - We participate in that conversation
      // - We are NOT currently viewing that conversation
      if (
        userId !== user.id &&
        participatingConversationsRef.current.has(conversationId) &&
        !isViewingConversation(conversationId)
      ) {
        notifyTyping();
      }
    };

    const typingChannel = supabase
      .channel(`global-typing-notifications-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'typing_indicators' },
        handleTypingEvent
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'typing_indicators' },
        handleTypingEvent
      )
      .subscribe();

    typingChannelRef.current = typingChannel;

    return () => {
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
    };
  }, [user, notifyMessage, notifyTyping, isViewingConversation]);

  // Refresh conversation list periodically (new groups, etc.)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (data) {
        participatingConversationsRef.current = new Set(data.map(d => d.conversation_id));
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [user]);

  return null;
}
