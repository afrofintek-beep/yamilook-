import PaposBrand from '@/features/papos/PaposBrand';
import { useAppSurface } from '@/lib/app-surface';
import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  MessageCircle, 
  Search, 
  Plus,
  Bell,
  CheckSquare,
  Phone,
  Video
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useConversations, type Conversation } from '@/hooks/useChat';
import { SwipeableConversationItem } from '@/components/chat/SwipeableConversationItem';
import { NewChatSheet } from '@/components/chat/NewChatSheet';
import { GlobalSearch } from '@/components/chat/GlobalSearch';
import { ForwardMessageSheet } from '@/components/chat/ForwardMessageSheet';
import { ConversationSelectionBar } from '@/components/chat/ConversationSelectionBar';
import BottomNav from '@/components/BottomNav';
import { ConversationsSkeleton } from '@/components/ui/ShimmerSkeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { CallsTabContent } from '@/components/calls/CallsTabContent';
import { StatusList } from '@/components/status/StatusList';
import { useActiveCall } from '@/components/calls/ActiveCallProvider';

export default function Home() {
  const { t } = useTranslation();
  const surface = useAppSurface();
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const activeCallContext = useActiveCall();
  const { conversations, loading, refresh } = useConversations();

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState<Conversation['last_message'] | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'chat' | 'status' | 'calls'>('chat');
  const { toast } = useToast();

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!authLoading && profile && !profile.onboarding_completed) {
      navigate('/onboarding', { replace: true });
    }
  }, [authLoading, profile, navigate]);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // Handler for starting calls from CallsTabContent
  const handleStartCallFromTab = useCallback(async (userId: string, type: 'voice' | 'video') => {
    if (activeCallContext) {
      await activeCallContext.startCall(userId, type);
    }
  }, [activeCallContext]);

  // Selection mode handlers
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => !prev);
    setSelectedIds(new Set());
  }, []);

  const enterSelectionModeWithItem = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleBulkArchive = useCallback(async () => {
    if (!user?.id || selectedIds.size === 0) return;
    
    const { data, error } = await supabase
      .from('conversation_participants')
      .update({ is_archived: true })
      .in('conversation_id', Array.from(selectedIds))
      .eq('user_id', user.id)
      .select('conversation_id');

    if (error || data?.length !== selectedIds.size) {
      toast({ title: 'Erro', description: error?.message || 'Não foi possível confirmar o arquivo de todas as conversas. Tenta novamente.', variant: 'destructive' });
    } else {
      toast({ title: `${selectedIds.size} conversa(s) arquivada(s)` });
      setSelectionMode(false);
      setSelectedIds(new Set());
      refresh();
    }
  }, [selectedIds, user?.id, toast, refresh]);

  const handleBulkPin = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    const { error } = await supabase
      .from('conversation_participants')
      .update({ is_pinned: true })
      .in('conversation_id', Array.from(selectedIds))
      .eq('user_id', user?.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${selectedIds.size} conversa(s) fixada(s)` });
      setSelectionMode(false);
      setSelectedIds(new Set());
      refresh();
    }
  }, [selectedIds, user?.id, toast, refresh]);

  const handleBulkMute = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    const { error } = await supabase
      .from('conversation_participants')
      .update({ is_muted: true })
      .in('conversation_id', Array.from(selectedIds))
      .eq('user_id', user?.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${selectedIds.size} conversa(s) silenciada(s)` });
      setSelectionMode(false);
      setSelectedIds(new Set());
      refresh();
    }
  }, [selectedIds, user?.id, toast, refresh]);

  // Swipe action handlers
  const handleArchive = useCallback(async (conversationId: string) => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('conversation_participants')
      .update({ is_archived: true })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .select('conversation_id')
      .single();

    if (error || !data) {
      toast({ title: 'Erro', description: error?.message || 'Não foi possível confirmar o arquivo. Tenta novamente.', variant: 'destructive' });
    } else {
      toast({ title: 'Conversa arquivada' });
      refresh();
    }
  }, [user?.id, toast, refresh]);

  const handlePin = useCallback(async (conversationId: string, isPinned: boolean) => {
    const { error } = await supabase
      .from('conversation_participants')
      .update({ is_pinned: !isPinned })
      .eq('conversation_id', conversationId)
      .eq('user_id', user?.id);

    if (!error) {
      toast({ title: isPinned ? 'Chat desafixado' : 'Chat fixado' });
      refresh();
    } else { toast({ title: 'Não foi possível fixar a conversa', variant: 'destructive' }); }
  }, [user?.id, toast, refresh]);

  const handleMute = useCallback(async (conversationId: string, isMuted: boolean) => {
    const { error } = await supabase
      .from('conversation_participants')
      .update({ is_muted: !isMuted })
      .eq('conversation_id', conversationId)
      .eq('user_id', user?.id);

    if (!error) {
      toast({ title: isMuted ? 'Notificações ativadas' : 'Chat silenciado' });
      refresh();
    } else { toast({ title: 'Não foi possível atualizar as notificações', variant: 'destructive' }); }
  }, [user?.id, toast, refresh]);

  const handleReply = useCallback((conversationId: string) => {
    navigate(`/chat/${conversationId}?focus=input`);
  }, [navigate]);

  const handleCopy = useCallback(async (conversation: Conversation) => {
    const lastMessage = conversation.last_message?.content;
    if (lastMessage) {
      try { await navigator.clipboard.writeText(lastMessage); toast({ title: 'Mensagem copiada' }); }
      catch { toast({ title: 'Não foi possível copiar a mensagem', variant: 'destructive' }); }
    }
  }, [toast]);

  const handleForward = useCallback((conversation: Conversation) => {
    const lastMessage = conversation.last_message;
    if (lastMessage && !lastMessage.is_deleted) {
      setMessageToForward(lastMessage);
      setForwardOpen(true);
    } else {
      toast({ title: 'Sem mensagem para encaminhar', variant: 'destructive' });
    }
  }, [toast]);

  return (
    <div className="h-screen-safe w-full min-w-0 overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))] bg-background flex flex-col">
      <header className="shrink-0 relative z-50 glass-nav safe-top">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/profile')} className="focus:outline-none">
              <Avatar className="w-9 h-9 ring-2 ring-primary/15">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {profile?.display_name?.[0]?.toUpperCase() || 'Y'}
                </AvatarFallback>
              </Avatar>
            </button>
            {surface === 'papos' ? <PaposBrand compact /> : <span className="text-base font-bold text-foreground tracking-tight">KOSOLOLA</span>}
          </div>
          <div className="flex items-center gap-1">
            {!selectionMode && (
              <>
                <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => setSearchOpen(true)}>
                  <Search className="w-4.5 h-4.5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-xl h-9 w-9 relative"
                  aria-label={surface === 'papos' ? 'Instalar KOSOLOLA' : 'Notificações'}
                  onClick={() => navigate(surface === 'papos' ? '/install' : '/notifications')}
                >
                  <Bell className="w-4.5 h-4.5" />
                  {surface !== 'papos' && totalUnread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-xl h-9 w-9"
                  onClick={toggleSelectionMode}
                  title="Selecionar conversas"
                >
                  <CheckSquare className="w-4.5 h-4.5" />
                </Button>
              </>
            )}
            {selectionMode && (
              <Button 
                variant="ghost" 
                size="sm"
                className="text-primary font-semibold"
                onClick={toggleSelectionMode}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
        {/* Tabs */}
        <div className="flex relative px-1">
          {(['chat', 'status', 'calls'] as const).map((tabKey) => (
            <button
              key={tabKey}
              className={`flex-1 py-2.5 text-[13px] font-medium transition-colors relative ${
                activeTab === tabKey ? 'text-primary font-semibold' : 'text-muted-foreground/60 hover:text-muted-foreground'
              }`}
              onClick={() => { setActiveTab(tabKey); setSelectionMode(false); setSelectedIds(new Set()); }}
            >
              {tabKey === 'chat' ? t('nav.chat') : tabKey === 'status' ? t('nav.status') : t('nav.calls')}
              {activeTab === tabKey && (
                <motion.span 
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-[2px] bg-primary rounded-full" 
                />
              )}
            </button>
          ))}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-border/20" />
        </div>
      </header>

      {surface === 'yamilook' && <a href="/papos-app/install" className="shrink-0 px-4 py-2 text-xs text-primary border-b border-border/50">Instalar a KOSOLOLA como aplicação separada</a>}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'chat' && (
          <motion.div 
            key="chat"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y"
          >
            {loading ? (
              <ConversationsSkeleton count={6} />
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8 py-20">
                <div className="w-16 h-16 rounded-2xl bg-card border border-border/30 flex items-center justify-center mb-4">
                  <MessageCircle className="w-7 h-7 text-muted-foreground/30" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{t('chat.noMessages')}</h3>
                <p className="text-xs text-muted-foreground/60 mb-5">{t('chat.startConversation')}</p>
                <Button className="rounded-full gap-1.5" onClick={() => setNewChatOpen(true)}>
                  <Plus className="w-4 h-4" />{t('chat.newChat')}
                </Button>
              </div>
            ) : (
              <div className={`divide-y divide-border/30 min-w-0 ${selectionMode && selectedIds.size > 0 ? 'pb-20' : ''}`}>
                {conversations.map((conversation) => (
                  <SwipeableConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    currentUserId={user?.id || ''}
                    onClick={() => navigate(`/chat/${conversation.id}`)}
                    isPinned={conversation.is_pinned ?? undefined}
                    isMuted={conversation.is_muted ?? undefined}
                    isSelectionMode={selectionMode}
                    isSelected={selectedIds.has(conversation.id)}
                    onSelect={toggleSelection}
                    onEnterSelectionMode={enterSelectionModeWithItem}
                    onArchive={() => handleArchive(conversation.id)}
                    onPin={() => handlePin(conversation.id, conversation.is_pinned ?? false)}
                    onMute={() => handleMute(conversation.id, conversation.is_muted ?? false)}
                    onReply={() => handleReply(conversation.id)}
                    onCopy={() => handleCopy(conversation)}
                    onForward={() => handleForward(conversation)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'status' && (
          <motion.div 
            key="status"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y"
          >
            <StatusList />
          </motion.div>
        )}

        {activeTab === 'calls' && (
          <motion.div 
            key="calls"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y flex flex-col"
          >
            <CallsTabContent onStartCall={handleStartCallFromTab} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      {!selectionMode && (
        <button 
          className="fab-safe-bottom fixed right-5 w-13 h-13 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
          onClick={() => {
            if (activeTab === 'chat') {
              setNewChatOpen(true);
            } else if (activeTab === 'calls') {
              navigate('/contacts');
            } else {
              navigate('/status');
            }
          }}
        >
          {activeTab === 'calls' ? (
            <Phone className="w-5 h-5" strokeWidth={2.5} />
          ) : (
            <Plus className="w-5 h-5" strokeWidth={2.5} />
          )}
        </button>
      )}

      {/* Selection mode action bar */}
      <AnimatePresence>
        {selectionMode && selectedIds.size > 0 && (
          <ConversationSelectionBar
            selectedCount={selectedIds.size}
            onCancel={toggleSelectionMode}
            onArchive={handleBulkArchive}
            onPin={handleBulkPin}
            onMute={handleBulkMute}
          />
        )}
      </AnimatePresence>

      <NewChatSheet open={newChatOpen} onOpenChange={setNewChatOpen} />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <ForwardMessageSheet
        open={forwardOpen}
        onOpenChange={setForwardOpen}
        message={messageToForward}
        onClose={() => {
          setForwardOpen(false);
          setMessageToForward(null);
        }}
      />

      <BottomNav />
    </div>
  );
}
