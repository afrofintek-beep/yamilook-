import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archive, ArchiveRestore, Trash2, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ArchivedChat {
  id: string;
  type: string;
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
  other_participant?: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface ArchivedChatsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchivedChatsSheet({ open, onOpenChange }: ArchivedChatsSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [archivedChats, setArchivedChats] = useState<ArchivedChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchArchivedChats = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get archived conversation IDs for this user
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)
        .eq('is_archived', true);

      if (partError) throw partError;

      const conversationIds = participations?.map(p => p.conversation_id) || [];
      
      if (conversationIds.length === 0) {
        setArchivedChats([]);
        setLoading(false);
        return;
      }

      // Fetch conversations
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds);

      if (convError) throw convError;

      // Get all participants for these conversations
      const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds);

      // Get other participant profiles for direct chats
      const otherUserIds = allParticipants
        ?.filter(p => p.user_id !== user.id)
        .map(p => p.user_id) || [];

      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', otherUserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Map conversations with participant info
      const mapped: ArchivedChat[] = (conversations || []).map(conv => {
        const otherParticipant = allParticipants
          ?.filter(p => p.conversation_id === conv.id && p.user_id !== user.id)
          .map(p => profileMap.get(p.user_id))
          .find(Boolean);

        return {
          id: conv.id,
          type: conv.type,
          name: conv.name,
          avatar_url: conv.avatar_url,
          updated_at: conv.updated_at,
          other_participant: otherParticipant ? {
            display_name: otherParticipant.display_name,
            avatar_url: otherParticipant.avatar_url,
          } : undefined,
        };
      });

      setArchivedChats(mapped);
    } catch (error) {
      console.error('Error fetching archived chats:', error);
      toast({ title: 'Erro ao carregar conversas arquivadas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (open) {
      fetchArchivedChats();
    }
  }, [open, fetchArchivedChats]);

  const handleRestore = async (conversationId: string) => {
    if (!user) return;
    setActionLoading(conversationId);

    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .update({ is_archived: false })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .select('conversation_id')
        .single();

      if (error || !data) throw error || new Error('Restauro não confirmado');

      setArchivedChats(prev => prev.filter(c => c.id !== conversationId));
      toast({ title: 'Conversa restaurada' });
    } catch (error) {
      console.error('Error restoring chat:', error);
      toast({ title: 'Erro ao restaurar', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (conversationId: string) => {
    if (!user) return;
    setActionLoading(conversationId);

    try {
      // Remove user from conversation (soft delete)
      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setArchivedChats(prev => prev.filter(c => c.id !== conversationId));
      toast({ title: 'Conversa eliminada' });
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({ title: 'Erro ao eliminar', variant: 'destructive' });
    } finally {
      setActionLoading(null);
      setDeleteConfirmId(null);
    }
  };

  const getDisplayName = (chat: ArchivedChat) => {
    if (chat.type === 'group') {
      return chat.name || 'Grupo';
    }
    return chat.other_participant?.display_name || 'Utilizador';
  };

  const getAvatarUrl = (chat: ArchivedChat) => {
    if (chat.type === 'group') {
      return chat.avatar_url;
    }
    return chat.other_participant?.avatar_url;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex h-[100dvh] w-full flex-col gap-0 overflow-hidden p-0 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] sm:max-w-md">
          <SheetHeader className="shrink-0 p-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Conversas Arquivadas
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : archivedChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Archive className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Sem conversas arquivadas</h3>
                <p className="text-muted-foreground text-sm">
                  As conversas que arquivares aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                <AnimatePresence mode="popLayout">
                  {archivedChats.map((chat, index) => {
                    const displayName = getDisplayName(chat);
                    const avatarUrl = getAvatarUrl(chat);
                    const initials = getInitials(displayName);
                    const isLoading = actionLoading === chat.id;

                    return (
                      <motion.div
                        key={chat.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20, height: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors"
                      >
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={avatarUrl || ''} />
                          <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {chat.type === 'group' ? 'Grupo' : 'Conversa'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full text-primary hover:bg-primary/10"
                            onClick={() => handleRestore(chat.id)}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ArchiveRestore className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteConfirmId(chat.id)}
                            disabled={isLoading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A conversa será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
