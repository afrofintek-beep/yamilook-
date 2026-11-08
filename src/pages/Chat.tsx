import { uiLocale, uiText, useUiLocale } from '@/i18n/ui-copy';
import { useGroupConference } from '@/features/group-calls/GroupConferenceProvider';
import { isRecentlyOnline } from '@/lib/online-presence';
import { usePresenceClock } from '@/hooks/usePresenceClock';
import { useEffect, useRef, useState, useCallback } from 'react';
import { scrollChatToEnd, scrollChatToMessage } from '@/lib/chat-scroll';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Phone,
  Video,
  MoreVertical,
  Search,
  Pin,
  Star,
  Trash2,
  Bell,
  BellOff,
  Image,
  Clock,
  Archive,
  CheckSquare,
  Highlighter,
  Link2,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useMessages, useConversations } from '@/hooks/useChat';
import { useSettings } from '@/hooks/useSettings';
import { EnhancedMessageBubble } from '@/components/chat/EnhancedMessageBubble';
import type { BubbleMessage } from '@/components/chat/EnhancedMessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { DateSeparator, shouldShowDateSeparator } from '@/components/chat/DateSeparator';
import { EnhancedChatInput } from '@/components/chat/EnhancedChatInput';
import { MediaGallery } from '@/components/chat/MediaGallery';
import { ScheduledMessagesList } from '@/components/chat/ScheduledMessagesList';
import { DisappearingMessagesSheet } from '@/components/chat/DisappearingMessagesSheet';
import { MessageSelectionBar } from '@/components/chat/MessageSelectionBar';
import { ForwardMessageSheet } from '@/components/chat/ForwardMessageSheet';
import { GroupInviteSheet } from '@/components/chat/GroupInviteSheet';
import { GroupAdminSheet } from '@/components/chat/GroupAdminSheet';
import { useActiveCall } from '@/components/calls/ActiveCallProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { getWallpaperStyles } from '@/components/settings/ChatWallpaperSheet';
import { formatLastSeen } from '@/components/ui/OnlineStatus';
import { useAppSurface } from '@/lib/app-surface';
import { mediaCaption } from '@/lib/chat-media';

export default function Chat() {
  useUiLocale();
  const navigate = useNavigate();
  const isKosolola = useAppSurface() === 'papos';
  const { t } = useTranslation();
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const highlightMessageId = searchParams.get('highlight');
  const { user, profile: currentUserProfile } = useAuth();
  const { toast } = useToast();
  const activeCall = useActiveCall();
  const startCall = activeCall?.startCall;
  const groupConference = useGroupConference();
  const { settings } = useSettings();
  const { conversations, loading: conversationsLoading, refresh: refreshConversations, createConversation } = useConversations();

  // Get wallpaper styles
  const wallpaperStyles = getWallpaperStyles(settings?.chat_wallpaper);
  const {
    messages,
    reactions,
    starredIds,
    pinnedIds,
    viewOnceViewedIds,
    loading,
    hasOlderMessages,
    loadingOlder,
    loadOlderMessages,
    loadError,
    refresh: refreshMessages,
    typingUsers,
    sendMessage,
    updateMessageMediaUrl,
    setTyping,
    deleteMessage,
    deleteMessageForMe,
    toggleReaction,
    toggleStar,
    togglePin,
    searchMessages,
    markViewOnce,
    historyClearedAt, setHistoryCleared,
  } = useMessages(conversationId || null);

  const [slowInitialLoad, setSlowInitialLoad] = useState(false);
  useEffect(() => {
    if (!loading) { setSlowInitialLoad(false); return; }
    setSlowInitialLoad(false);
    const timer = window.setTimeout(() => setSlowInitialLoad(true), 6500);
    return () => window.clearTimeout(timer);
  }, [loading, conversationId, user?.id]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [replyTo, setReplyTo] = useState<BubbleMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Tables<'messages'>[]>([]);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
  const [scheduledMessagesOpen, setScheduledMessagesOpen] = useState(false);
  const [disappearingOpen, setDisappearingOpen] = useState(false);
  const [highlights, setHighlights] = useState<Record<string, { color: string; label?: string }>>({});
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [collectionTab, setCollectionTab] = useState<'highlights' | 'starred'>('highlights');
  const [collectionSearch, setCollectionSearch] = useState('');
  const [collectionColor, setCollectionColor] = useState('');
  const [collectionType, setCollectionType] = useState('all');
  const [collectionDate, setCollectionDate] = useState('');

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [forwardSheetOpen, setForwardSheetOpen] = useState(false);
  const [messagesToForward, setMessagesToForward] = useState<string[]>([]);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [adminSheetOpen, setAdminSheetOpen] = useState(false);

  const conversation = conversations.find((c) => c.id === conversationId);
  const otherParticipantFromConv = conversation?.participants?.find((p) => p.user_id !== user?.id)?.profile;
  const isGroup = conversation?.type === 'group';
  const [resolvingChat, setResolvingChat] = useState(false);

  // If we were navigated to /chat/<userId> by mistake, resolve to a real conversation id.
  useEffect(() => {
    if (!user || !conversationId || conversationsLoading) return;
    if (conversation || resolvingChat) return;

    void (async () => {
      setResolvingChat(true);
      try {
        const { data: profile } = await supabase
          .from('public_profiles')
          .select('id')
          .eq('id', conversationId)
          .maybeSingle();

        if (profile?.id && profile.id !== user.id) {
          const { data, error } = await createConversation([profile.id]);
          if (!error && data) {
            navigate(`/chat/${data.id}`, { replace: true });
          }
        }
      } finally {
        setResolvingChat(false);
      }
    })();
  }, [user, conversationId, conversationsLoading, conversation, resolvingChat, createConversation, navigate]);

  // Real-time online status state
  const [otherUserOnline, setOtherUserOnline] = useState(otherParticipantFromConv?.is_online || false);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState(otherParticipantFromConv?.last_seen || null);
  // Other user's privacy settings
  const [otherUserShowOnlineStatus, setOtherUserShowOnlineStatus] = useState<boolean>(otherParticipantFromConv?.show_online_status !== false);
  const [otherUserShowLastSeen, setOtherUserShowLastSeen] = useState<boolean>(otherParticipantFromConv?.show_last_seen !== false);
  const [otherUserShowTypingIndicators, setOtherUserShowTypingIndicators] = useState<boolean>(true);

  // Combine profile data with real-time status
  const otherParticipant = otherParticipantFromConv ? {
    ...otherParticipantFromConv,
    is_online: otherUserOnline,
    last_seen: otherUserLastSeen,
  } : undefined;

  // Fallback id for header profile navigation (covers cases where conversation participants
  // haven't loaded yet but messages are already visible)
  const headerProfileUserId = !isGroup
    ? (otherParticipant?.id ||
        otherParticipantFromConv?.id ||
        messages.find((m) => m.sender_id !== user?.id)?.sender_id)
    : undefined;

  const displayName = isGroup ? conversation?.name || 'Group Chat' : otherParticipant?.display_name || 'Chat';
  const avatarUrl = isGroup ? conversation?.avatar_url : otherParticipant?.avatar_url;
  // Only show online if the other user allows it
  const presenceNow = usePresenceClock();
  const isOnline = !isGroup && otherUserShowOnlineStatus && isRecentlyOnline(otherUserOnline, otherUserLastSeen, presenceNow);

  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  // The conversation hook reconciles missed mobile Realtime events. Keep the
  // open chat header in sync too, even when the participant ID has not changed.
  useEffect(() => {
    setOtherUserOnline(otherParticipantFromConv?.is_online ?? false);
    setOtherUserLastSeen(otherParticipantFromConv?.last_seen ?? null);
    setOtherUserShowOnlineStatus(otherParticipantFromConv?.show_online_status !== false);
    setOtherUserShowLastSeen(otherParticipantFromConv?.show_last_seen !== false);
  }, [otherParticipantFromConv?.id, otherParticipantFromConv?.is_online, otherParticipantFromConv?.last_seen,
    otherParticipantFromConv?.show_online_status, otherParticipantFromConv?.show_last_seen]);

  // Subscribe to real-time online status updates AND fetch privacy settings
  useEffect(() => {
    if (!otherParticipantFromConv?.id || isGroup) return;

    // Initialize with current value
    setOtherUserOnline(otherParticipantFromConv.is_online || false);
    setOtherUserLastSeen(otherParticipantFromConv.last_seen || null);

    // Fetch the other user's privacy settings
    const fetchPrivacySettings = async () => {
      const { data } = await supabase
        .from('public_profiles')
        .select('show_online_status, show_last_seen, show_typing_indicators')
        .eq('id', otherParticipantFromConv.id)
        .single();

      if (data) {
        setOtherUserShowOnlineStatus(data.show_online_status ?? true);
        setOtherUserShowLastSeen(data.show_last_seen ?? true);
        setOtherUserShowTypingIndicators(data.show_typing_indicators ?? true);
      }
    };

    fetchPrivacySettings();

    const channel = supabase
      .channel(`profile-status-${otherParticipantFromConv.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profile_presence',
        filter: `id=eq.${otherParticipantFromConv.id}`,
      }, (payload) => {
        const updated = payload.new as {
          is_online?: boolean;
          last_seen?: string | null;
          show_online_status?: boolean;
          show_last_seen?: boolean;
          show_typing_indicators?: boolean;
        };
        if (typeof updated.is_online === 'boolean') {
          setOtherUserOnline(updated.is_online);
        }
        if ('last_seen' in updated) {
          setOtherUserLastSeen(updated.last_seen ?? null);
        }
        if (typeof updated.show_online_status === 'boolean') {
          setOtherUserShowOnlineStatus(updated.show_online_status);
        }
        if (typeof updated.show_last_seen === 'boolean') {
          setOtherUserShowLastSeen(updated.show_last_seen);
        }
        if (typeof updated.show_typing_indicators === 'boolean') {
          setOtherUserShowTypingIndicators(updated.show_typing_indicators);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [otherParticipantFromConv?.id, isGroup]);

  // Get pinned messages
  const pinnedMessages = messages.filter((m) => pinnedIds.has(m.id));

  // Highlights depend on message membership, not typing, receipts or profiles.
  const highlightedMessageIdsKey = JSON.stringify(messages.map(message => message.id));
  useEffect(() => {
    let cancelled = false;
    const fetchHighlights = async () => {
      setHighlights({});
      if (!user?.id || !conversationId) return;

      const messageIds: string[] = JSON.parse(highlightedMessageIdsKey);
      if (messageIds.length === 0) return;

      const { data } = await supabase
        .from('message_highlights')
        .select('message_id, color, label')
        .eq('user_id', user.id)
        .in('message_id', messageIds);

      const highlightsMap: Record<string, { color: string; label?: string }> = {};
      (data || []).forEach((h) => {
        highlightsMap[h.message_id] = { color: h.color, label: h.label || undefined };
      });
      if (!cancelled) setHighlights(highlightsMap);
    };

    fetchHighlights();
    return () => { cancelled = true; };
  }, [highlightedMessageIdsKey, user?.id, conversationId]);

  // The collection is intentionally limited to messages already loaded in this
  // conversation. It never searches or exposes other participants' conversations.
  const collectionMessages = messages.filter(message => {
    if (message.is_deleted) return false;
    if (collectionTab === 'starred') return starredIds.has(message.id);
    const mark = highlights[message.id];
    if (!mark || (collectionColor && mark.color !== collectionColor)) return false;
    if (collectionType !== 'all') {
      const type = message.message_type;
      if (collectionType === 'text' && type !== 'text') return false;
      if (collectionType === 'media' && type !== 'image' && type !== 'video') return false;
      if (collectionType === 'file' && type !== 'file' && type !== 'voice') return false;
    }
    if (collectionDate && message.created_at.slice(0, 10) !== collectionDate) return false;
    if (collectionSearch.trim()) {
      const caption = message.is_view_once ? '' : (mediaCaption(message.content, message.media_url) || '');
      if (!`${mark.label || ''} ${caption}`.toLocaleLowerCase().includes(collectionSearch.trim().toLocaleLowerCase())) return false;
    }
    return true;
  }).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));

  const showCollection = (tab: 'highlights' | 'starred') => {
    setCollectionTab(tab);
    setCollectionSearch('');
    setCollectionColor('');
    setCollectionType('all');
    setCollectionDate('');
    setCollectionsOpen(true);
  };

  // Scroll to highlighted message from search
  useEffect(() => {
    if (highlightMessageId && highlightRef.current) {
      scrollChatToMessage(messagesViewportRef.current, highlightRef.current);
    }
  }, [highlightMessageId, messages]);

  // Initial scroll to bottom when messages load (no highlight)
  useEffect(() => {
    if (!loading && messages.length > 0 && messagesEndRef.current && !highlightMessageId) {
      // Small delay to ensure DOM is ready
      const timeout = setTimeout(() => {
        scrollChatToEnd(messagesViewportRef.current, 'auto');
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [loading, conversationId, highlightMessageId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoScroll && messagesEndRef.current && !highlightMessageId && !loading) {
      scrollChatToEnd(messagesViewportRef.current, 'smooth');
    }
  }, [messages, autoScroll, highlightMessageId, loading]);

  const handleLoadEarlier = async () => {
    setAutoScroll(false);
    const viewport = messagesViewportRef.current;
    const heightBefore = viewport?.scrollHeight ?? 0;
    const topBefore = viewport?.scrollTop ?? 0;
    await loadOlderMessages();
    requestAnimationFrame(() => {
      if (viewport && heightBefore) viewport.scrollTop = topBefore + viewport.scrollHeight - heightBefore;
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  };

  const handleSend = async (
    content: string,
    type?: string,
    mediaUrl?: string,
    replyToId?: string,
    duration?: number,
    isViewOnce?: boolean,
    thumbnailUrl?: string
  ): Promise<{ messageId?: string }> => {
    const { error, messageId } = await sendMessage(content, type, mediaUrl, replyToId || replyTo?.id, duration, isViewOnce, thumbnailUrl);
    if (error) {
      toast({ title: uiText("Mensagem não enviada"), description: error.message, variant: 'destructive' });
      return {};
    }
    setReplyTo(null);
    return { messageId };
  };

  const handleClearHistory = async (restore = false) => {
    setClearingHistory(true);
    try {
      await setHistoryCleared(restore);
      await refreshConversations();
      setClearHistoryOpen(false);
      toast({ title: restore ? 'Histórico restaurado' : 'Histórico limpo só para ti' });
    } catch {
      toast({ title: uiText("Não foi possível atualizar o histórico"), variant: 'destructive' });
    } finally {
      setClearingHistory(false);
    }
  };

  const handleUpdateMediaUrl = async (messageId: string, newMediaUrl: string) => {
    await updateMessageMediaUrl(messageId, newMediaUrl);
  };

  const handleScheduleMessage = async (
    content: string,
    scheduledFor: Date,
    isRecurring: boolean,
    pattern?: string
  ) => {
    if (!conversationId || !user) return;

    const { error } = await supabase.from('scheduled_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      message_type: 'text',
      scheduled_for: scheduledFor.toISOString(),
      is_recurring: isRecurring,
      recurrence_pattern: pattern || null,
    });

    if (error) {
      toast({ title: uiText("Error"), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: uiText("Message scheduled") });
    }
  };

  const handleDelete = async (messageId: string) => {
    const { error } = await deleteMessage(messageId);
    if (error) {
      toast({ title: uiText("Não foi possível apagar a mensagem"), description: error.message, variant: 'destructive' });
      throw error;
    } else {
      toast({ title: uiText("Mensagem apagada") });
    }
  };

  const handleDeleteForMe = async (messageId: string) => {
    const { error } = await deleteMessageForMe(messageId);
    if (error) throw error;
    toast({ title: uiText("Mensagem apagada só para ti") });
  };

  const handleReact = async (messageId: string, emoji: string) => {
    await toggleReaction(messageId, emoji);
  };

  const handleStar = async (messageId: string) => {
    await toggleStar(messageId);
    toast({ title: starredIds.has(messageId) ? 'Removed from starred' : 'Added to starred' });
  };

  const handlePin = async (messageId: string) => {
    await togglePin(messageId);
    toast({ title: pinnedIds.has(messageId) ? 'Unpinned' : 'Pinned' });
  };

  const handleHighlight = async (messageId: string, color: string, label?: string) => {
    if (!user) return;

    // Check if already highlighted
    const existing = highlights[messageId];

    if (existing) {
      // Update
      await supabase
        .from('message_highlights')
        .update({ color, label: label || null })
        .eq('message_id', messageId)
        .eq('user_id', user.id);
    } else {
      // Insert
      await supabase.from('message_highlights').insert({
        message_id: messageId,
        user_id: user.id,
        color,
        label: label || null,
      });
    }

    setHighlights((prev) => ({
      ...prev,
      [messageId]: { color, label },
    }));
    toast({ title: uiText("Message highlighted") });
  };

  const handleRemoveHighlight = async (messageId: string) => {
    if (!user) return;

    await supabase
      .from('message_highlights')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id);

    setHighlights((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
    toast({ title: uiText("Highlight removed") });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const results = await searchMessages(searchQuery);
    setSearchResults(results);
  };

  useEffect(() => {
    const debounce = setTimeout(handleSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const shouldShowAvatar = (index: number) => {
    if (index === messages.length - 1) return true;
    return messages[index].sender_id !== messages[index + 1].sender_id;
  };

  // Multi-select handlers
  const handleToggleSelect = useCallback((messageId: string) => {
    setSelectedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
        if (next.size === 0) {
          setSelectionMode(false);
        }
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const handleLongPressSelect = useCallback((messageId: string) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedMessages(new Set([messageId]));
    }
  }, [selectionMode]);

  const handleCancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedMessages(new Set());
  }, []);

  const handleBatchDelete = async () => {
    const ownMessages = Array.from(selectedMessages).filter(id => {
      const msg = messages.find(m => m.id === id);
      return msg?.sender_id === user?.id;
    });

    if (ownMessages.length === 0) {
      toast({ title: uiText("Só podes apagar as tuas mensagens"), variant: 'destructive' });
      return;
    }

    const failed = new Set<string>();
    for (const id of ownMessages) {
      const { error } = await deleteMessage(id);
      if (error) failed.add(id);
    }
    const deleted = ownMessages.length - failed.size;
    if (failed.size) {
      setSelectedMessages(failed);
      toast({ title: uiText("{{value1}} apagada(s); {{value2}} não confirmada(s)", { value1: (deleted) ?? "", value2: (failed.size) ?? "" }), description: uiText("As mensagens que falharam continuam selecionadas. Tenta novamente."), variant: 'destructive' });
    } else {
      toast({ title: uiText("{{value1}} mensagem(ns) apagada(s)", { value1: (deleted) ?? "" }) });
      handleCancelSelection();
    }
  };

  const handleBatchForward = () => {
    setMessagesToForward(Array.from(selectedMessages));
    setForwardSheetOpen(true);
  };

  const handleBatchCopy = () => {
    const selectedMsgs = messages
      .filter(m => selectedMessages.has(m.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const text = selectedMsgs
      .map(m => m.content || '[media]')
      .join('\n');

    navigator.clipboard.writeText(text);
    toast({ title: uiText("Mensagens copiadas") });
    handleCancelSelection();
  };

  const handleBatchStar = async () => {
    for (const id of selectedMessages) {
      await toggleStar(id);
    }
    toast({ title: uiText("{{value1}} mensagem(ns) com estrela", { value1: (selectedMessages.size) ?? "" }) });
    handleCancelSelection();
  };

  const canDeleteSelected = Array.from(selectedMessages).some(id => {
    const msg = messages.find(m => m.id === id);
    return msg?.sender_id === user?.id;
  });

  const handleMuteToggle = async () => {
    if (!conversationId || !user) return;

    const { data: current } = await supabase
      .from('conversation_participants')
      .select('is_muted')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single();

    await supabase
      .from('conversation_participants')
      .update({ is_muted: !current?.is_muted })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    toast({ title: current?.is_muted ? 'Notifications enabled' : 'Chat muted' });
    refreshConversations();
  };

  const handleArchive = async () => {
    if (!conversationId || !user) return;

    const { data, error } = await supabase
      .from('conversation_participants')
      .update({ is_archived: true })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .select('conversation_id')
      .single();

    if (error || !data) {
      toast({ title: uiText("Não foi possível arquivar a conversa"), variant: 'destructive' });
      return;
    }
    toast({ title: uiText("Conversa arquivada") });
    navigate('/papos', { replace: true });
  };

  return (
    <div
      className="chat-page fixed inset-0 h-screen-safe bg-background flex flex-col overflow-hidden overscroll-none"
      style={isKosolola ? {
        top: 'var(--kosolola-top, 0px)',
        bottom: 'auto',
        height: 'var(--kosolola-height, 100dvh)',
      } : undefined}
    >
      {/* Header */}
      <header className="relative shrink-0 z-50 glass border-b border-border/50 safe-top safe-inline">
        <div className="flex items-center justify-between px-2 py-2">
          {selectionMode ? (
            // Selection mode header
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={handleCancelSelection}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                  {selectedMessages.size}
                </div>
                <span className="font-medium text-foreground">
                  {selectedMessages.size === 1 ? uiText("selecionada") : uiText("selecionadas")}
                </span>
              </div>
            </div>
          ) : (
            // Normal header
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Button variant="ghost" size="icon" aria-label={uiText("Voltar")} className="shrink-0 rounded-full" onClick={() => navigate(-1)}>
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <button
                className="flex min-w-0 items-center gap-3"
                onClick={() => headerProfileUserId && navigate(`/profile/${headerProfileUserId}`)}
              >
                <div className="relative shrink-0">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={avatarUrl || ''} />
                    <AvatarFallback className="bg-gradient-primary text-white text-sm">{initials}</AvatarFallback>
                  </Avatar>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 status-online rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="min-w-0 text-left">
                  <h1 className="truncate font-semibold text-base leading-tight">{displayName}</h1>
                  <p className="text-xs text-muted-foreground">
                    {typingUsers.length > 0 && otherUserShowTypingIndicators
                      ? t('chat.typing')
                      : isOnline
                      ? t('chat.online')
                      : otherUserShowLastSeen && otherParticipant?.last_seen
                      ? uiText("Visto {{value1}}", { value1: (formatLastSeen(otherParticipant.last_seen)) ?? "" })
                      : !isGroup && otherUserShowOnlineStatus
                      ? t('chat.offline')
                      : ''}
                  </p>
                </div>
              </button>
            </div>
          )}

          {!selectionMode && (
            <div className="flex shrink-0 items-center">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSearchOpen(true)}>
                <Search className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label={t('groupCalls.startVoice')}
                onClick={() => isGroup && conversationId ? groupConference?.open({conversationId, name:displayName, type:'voice'}) : otherParticipant && startCall?.(otherParticipant.id, 'voice', conversationId)}
              >
                <Phone className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label={t('groupCalls.startVideo')}
                onClick={() => isGroup && conversationId ? groupConference?.open({conversationId, name:displayName, type:'video'}) : otherParticipant && startCall?.(otherParticipant.id, 'video', conversationId)}
              >
                <Video className="w-5 h-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setSearchOpen(true)}>
                    <Search className="w-4 h-4 mr-2" />
                    {t('common.search')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setMediaGalleryOpen(true)}>
                    <Image className="w-4 h-4 mr-2" />
                    {t('chat.mediaFiles') || uiText("Media, files & links")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setScheduledMessagesOpen(true)}>
                    <Clock className="w-4 h-4 mr-2" />
                    {t('chat.scheduledMessages') || uiText("Scheduled messages")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => showCollection('starred')}>
                    <Star className="w-4 h-4 mr-2" />
                    {t('chat.starredMessages') || uiText("Mensagens com estrela")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => showCollection('highlights')}>
                    <Highlighter className="w-4 h-4 mr-2" />{uiText("Destaques")}</DropdownMenuItem>
                  {isGroup && (
                    <>
                      <DropdownMenuItem onClick={() => setAdminSheetOpen(true)}>
                        <Users className="w-4 h-4 mr-2" />{uiText("Administrar grupo")}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setInviteSheetOpen(true)}>
                        <Link2 className="w-4 h-4 mr-2" />{uiText("Convites por link")}</DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDisappearingOpen(true)}>
                    <Clock className="w-4 h-4 mr-2" />
                    {t('chat.disappearingMessages') || uiText("Disappearing messages")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleMuteToggle}>
                    <BellOff className="w-4 h-4 mr-2" />
                    {t('chat.muteNotifications') || uiText("Mute notifications")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="w-4 h-4 mr-2" />
                    {t('chat.archiveChat') || uiText("Archive chat")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setClearHistoryOpen(true)}>
                    <Trash2 className="w-4 h-4 mr-2" />{uiText("Limpar histórico só para mim")}</DropdownMenuItem>
                  {historyClearedAt && (
                    <DropdownMenuItem disabled={clearingHistory} onClick={() => void handleClearHistory(true)}>{uiText("Restaurar histórico")}</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Pinned messages banner */}
        {pinnedMessages.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b border-border/30">
            <Pin className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">{uiText("{{value1}} pinned message{{value2}}", { value1: (pinnedMessages.length) ?? "", value2: (pinnedMessages.length > 1 ? 's' : '') })}</span>
          </div>
        )}
      </header>

      {/* Messages */}
      <div
        ref={messagesViewportRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 relative"
        onScroll={handleScroll}
        style={wallpaperStyles}
      >
        {!loading && hasOlderMessages && (
          <div className="flex justify-center px-3 pb-3">
            <Button variant="outline" size="sm" disabled={loadingOlder}
              onClick={() => void handleLoadEarlier()}>
              {loadingOlder ? uiText("A carregar mensagens anteriores…") : uiText("Carregar mensagens anteriores")}
            </Button>
          </div>
        )}
        {loadError && !loading && messages.length === 0 ? (
          <div role="alert" className="mx-4 space-y-3 rounded-xl border border-border bg-background/85 p-4 text-sm">
            <p>{uiText("Não foi possível sincronizar esta conversa. Verifica a ligação e tenta novamente.")}</p>
            <Button variant="outline" size="sm" onClick={() => void refreshMessages()}>{uiText("Tentar novamente")}</Button>
          </div>
        ) : loading && slowInitialLoad ? (
          <div role="status" className="mx-4 rounded-xl border border-border bg-background/85 p-4 text-sm text-muted-foreground">{uiText("A ligação está lenta. Estamos a sincronizar esta conversa; o histórico surgirá assim que o servidor responder.")}</div>
        ) : loading ? (
          <div className="space-y-4 px-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                {i % 2 === 0 && <Skeleton className="w-8 h-8 rounded-full" />}
                <Skeleton className={`h-12 rounded-2xl ${i % 2 === 0 ? 'w-48' : 'w-40'}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 rounded-full bg-gradient-primary/10 flex items-center justify-center mb-4"
            >
              <Avatar className="w-16 h-16">
                <AvatarImage src={avatarUrl || ''} />
                <AvatarFallback className="bg-gradient-primary text-white text-xl">{initials}</AvatarFallback>
              </Avatar>
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">{displayName}</h3>
            <p className="text-muted-foreground text-sm">{t('chat.startConversation')}</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const currentDate = new Date(message.created_at);
              const previousDate = index > 0 ? new Date(messages[index - 1].created_at) : null;
              const showDateSeparator = shouldShowDateSeparator(currentDate, previousDate);

              return (
                <div key={message.id}>
                  {showDateSeparator && <DateSeparator date={currentDate} />}
                  <div
                    ref={message.id === highlightMessageId ? highlightRef : undefined}
                    className={highlightMessageId === message.id ? 'animate-pulse bg-primary/10 rounded-lg' : ''}
                  >
                    <EnhancedMessageBubble
                      message={message}
                      reactions={reactions[message.id] || []}
                      isOwn={message.sender_id === user?.id}
                      isStarred={starredIds.has(message.id)}
                      isPinned={pinnedIds.has(message.id)}
                      highlight={highlights[message.id]}
                      showAvatar={shouldShowAvatar(index)}
                      isGroupChat={isGroup}
                      currentUserId={user?.id || ''}
                      onDeleteForMe={handleDeleteForMe}
                      onDelete={message.sender_id === user?.id ? handleDelete : undefined}
                      onReply={selectionMode ? undefined : setReplyTo}
                      onReact={handleReact}
                      onStar={handleStar}
                      onPin={handlePin}
                      onHighlight={(color, label) => handleHighlight(message.id, color, label)}
                      onRemoveHighlight={() => handleRemoveHighlight(message.id)}
                      onViewOnce={async (msgId) => { await markViewOnce(msgId); }}
                      viewOnceViewed={viewOnceViewedIds.has(message.id)}
                      selectionMode={selectionMode}
                      isSelected={selectedMessages.has(message.id)}
                      onToggleSelect={() => handleToggleSelect(message.id)}
                      onLongPressSelect={() => handleLongPressSelect(message.id)}
                      showReadReceipts={currentUserProfile?.show_read_receipts ?? true}
                    />
                  </div>
                </div>
              );
            })}
            {otherUserShowTypingIndicators && <TypingIndicator users={typingUsers} />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <EnhancedChatInput
        onSend={handleSend}
        onUpdateMediaUrl={handleUpdateMediaUrl}
        onTyping={() => setTyping(currentUserProfile?.show_typing_indicators ?? true)}
        onSchedule={handleScheduleMessage}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        disabled={loading}
        focusInput={searchParams.get('focus') === 'input'}
        conversationId={conversationId || ''}
      />

      <AlertDialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("Limpar o histórico só para ti?")}</AlertDialogTitle>
            <AlertDialogDescription>{uiText("As mensagens atuais deixam de aparecer no teu histórico. Continuam disponíveis para a outra pessoa. Podes restaurar o teu histórico no menu da conversa.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingHistory}>{uiText("Cancelar")}</AlertDialogCancel>
            <Button disabled={clearingHistory} onClick={() => void handleClearHistory()}>
              {clearingHistory ? uiText("A limpar…") : uiText("Limpar só para mim")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Search Sheet */}
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('common.search')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat.typeMessage')}
              className="h-11"
            />
            <div className="max-h-[70vh] overflow-y-auto space-y-2">
              {searchResults.length === 0 && searchQuery && (
                <p className="text-center text-muted-foreground py-8">{t('chat.noMessages')}</p>
              )}
              {searchResults.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => {
                    setSearchOpen(false);
                    navigate(`/chat/${conversationId}?highlight=${msg.id}`);
                  }}
                  className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-colors"
                >
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(msg.created_at).toLocaleString(uiLocale())}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Personal highlights and starred messages, scoped to the current conversation. */}
      <Sheet open={collectionsOpen} onOpenChange={setCollectionsOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{collectionTab === 'highlights' ? uiText("Destaques") : uiText("Mensagens com estrela")}</SheetTitle>
          </SheetHeader>
          <p className="mt-2 text-xs text-muted-foreground">{uiText("Mensagens já carregadas desta conversa. Os destaques e as estrelas são pessoais.")}</p>
          <div className="mt-4 flex gap-2" role="group" aria-label={uiText("Tipo de mensagens guardadas")}>
            <Button size="sm" variant={collectionTab === 'highlights' ? 'default' : 'outline'}
              onClick={() => showCollection('highlights')}>{uiText("Destaques")}</Button>
            <Button size="sm" variant={collectionTab === 'starred' ? 'default' : 'outline'}
              onClick={() => showCollection('starred')}>{uiText("Estrelas")}</Button>
          </div>
          {collectionTab === 'highlights' && (
            <div className="mt-3 space-y-2">
              <Input aria-label={uiText("Pesquisar destaques")} placeholder={uiText("Pesquisar etiqueta ou mensagem")}
                value={collectionSearch} onChange={e => setCollectionSearch(e.target.value)}
                className="h-11 text-base" />
              <div className="flex flex-wrap gap-2" role="group" aria-label={uiText("Filtrar por cor")}>
                {[['', 'Todas'], ['yellow', 'Amarelo'], ['blue', 'Azul'], ['green', 'Verde'], ['pink', 'Rosa'], ['orange', 'Laranja'], ['purple', 'Roxo']].map(([color, label]) => (
                  <button type="button" key={color || 'all'} aria-pressed={collectionColor === color}
                    onClick={() => setCollectionColor(color)}
                    className={`min-h-9 rounded-full border px-3 text-xs ${collectionColor === color ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select aria-label={uiText("Tipo de conteúdo")} value={collectionType} onChange={e => setCollectionType(e.target.value)}
                  className="h-11 min-w-0 rounded-md border border-input bg-background px-2 text-base text-foreground">
                  <option value="all">{uiText("Todos os tipos")}</option>
                  <option value="text">{uiText("Texto")}</option>
                  <option value="media">{uiText("Fotos e vídeos")}</option>
                  <option value="file">{uiText("Ficheiros e áudio")}</option>
                </select>
                <input type="date" aria-label={uiText("Filtrar por data")} value={collectionDate}
                  onChange={e => setCollectionDate(e.target.value)}
                  className="h-11 min-w-0 rounded-md border border-input bg-background px-2 text-base text-foreground" />
              </div>
            </div>
          )}
          <div className="mt-4 space-y-2 pb-8">
            {collectionMessages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{uiText("Não há mensagens guardadas com estes filtros.")}</p>
            )}
            {collectionMessages.map(message => {
              const mark = highlights[message.id];
              const summary = message.is_view_once ? 'Conteúdo de visualização única'
                : message.message_type === 'image' || message.message_type === 'video'
                ? mediaCaption(message.content, message.media_url) || (message.message_type === 'image' ? 'Fotografia' : 'Vídeo')
                : message.content || (message.message_type === 'voice' ? 'Mensagem de voz' : 'Ficheiro');
              return (
                <button type="button" key={message.id} onClick={() => {
                  setCollectionsOpen(false);
                  navigate(`/chat/${conversationId}?highlight=${message.id}`);
                }} className="block w-full rounded-xl border border-border bg-secondary/30 p-3 text-left hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="flex items-center justify-between gap-2">
                    {collectionTab === 'highlights' && mark && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                        <Highlighter aria-hidden="true" className="h-3 w-3" />
                        {mark.label || uiText("Sem etiqueta")} · {mark.color}
                      </span>
                    )}
                    {collectionTab === 'starred' && <Star aria-hidden="true" className="h-3 w-3 text-amber-500" />}
                    <time className="ml-auto shrink-0 text-xs text-muted-foreground" dateTime={message.created_at}>
                      {new Date(message.created_at).toLocaleDateString(uiLocale())}
                    </time>
                  </div>
                  <p className="mt-1 line-clamp-2 break-words text-sm text-foreground">{summary}</p>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Media Gallery */}
      <MediaGallery
        open={mediaGalleryOpen}
        onOpenChange={setMediaGalleryOpen}
        conversationId={conversationId || ''}
      />

      {/* Scheduled Messages */}
      <ScheduledMessagesList
        open={scheduledMessagesOpen}
        onOpenChange={setScheduledMessagesOpen}
        conversationId={conversationId}
      />

      {/* Disappearing Messages Settings */}
      <DisappearingMessagesSheet
        open={disappearingOpen}
        onOpenChange={setDisappearingOpen}
        conversationId={conversationId || ''}
      />

      {/* Multi-select action bar */}
      <AnimatePresence>
        {selectionMode && selectedMessages.size > 0 && (
          <MessageSelectionBar
            selectedCount={selectedMessages.size}
            onCancel={handleCancelSelection}
            onDelete={handleBatchDelete}
            onForward={handleBatchForward}
            onCopy={handleBatchCopy}
            onStar={handleBatchStar}
            canDelete={canDeleteSelected}
          />
        )}
      </AnimatePresence>

      {/* Forward Messages Sheet */}
      <ForwardMessageSheet
        open={forwardSheetOpen}
        onOpenChange={(open) => {
          setForwardSheetOpen(open);
          if (!open) {
            setMessagesToForward([]);
            handleCancelSelection();
          }
        }}
        messageIds={messagesToForward}
        conversationId={conversationId || ''}
      />

      {/* Group Invite Sheet */}
      {isGroup && conversationId && (
        <>
          <GroupInviteSheet
            open={inviteSheetOpen}
            onOpenChange={setInviteSheetOpen}
            conversationId={conversationId}
            groupName={displayName}
          />
          <GroupAdminSheet
            open={adminSheetOpen}
            onOpenChange={setAdminSheetOpen}
            conversationId={conversationId}
            groupName={displayName}
            groupAvatarUrl={conversation?.avatar_url || null}
            onGroupUpdated={refreshConversations}
          />
        </>
      )}
    </div>
  );
}
