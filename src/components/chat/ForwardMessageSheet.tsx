import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, Check, Loader2, Forward } from 'lucide-react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useConversations, useMessages } from '@/hooks/useChat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ForwardMessageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Single message mode
  message?: {
    id: string;
    content: string | null;
    message_type: string;
    media_url: string | null;
    sender_id: string;
  } | null;
  // Multiple messages mode
  messageIds?: string[];
  conversationId?: string;
  // Legacy prop for backwards compatibility
  onClose?: () => void;
}

export function ForwardMessageSheet({ 
  open, 
  onOpenChange,
  message, 
  messageIds = [],
  conversationId,
  onClose,
}: ForwardMessageSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { conversations } = useConversations();
  const { messages: allMessages } = useMessages(conversationId || null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [forwarding, setForwarding] = useState(false);
  const forwardingRef = useRef(false);
  const sourceIds = message ? [message.id] : [...new Set(messageIds)];

  // Get messages to forward
  const messagesToForward = message 
    ? [message] 
    : allMessages.filter(m => messageIds.includes(m.id)).map(m => ({
        id: m.id,
        content: m.content,
        message_type: m.message_type,
        media_url: m.media_url,
        sender_id: m.sender_id,
      }));

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    
    const otherParticipant = conv.participants?.find((p) => p.user_id !== user?.id)?.profile;
    const name = conv.type === 'group' ? conv.name : otherParticipant?.display_name;
    
    return name?.toLowerCase().includes(query);
  });

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      if (newSelected.size >= 20) {
        toast({ title: 'Seleciona até 20 conversas de cada vez' });
        return;
      }
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleForward = async () => {
    if (!sourceIds.length || !user || !selectedIds.size || forwardingRef.current) return;

    forwardingRef.current = true;
    setForwarding(true);

    try {
      const { data, error } = await supabase.rpc('forward_chat_messages', {
        p_message_ids: sourceIds,
        p_conversation_ids: Array.from(selectedIds),
      });
      if (error) throw error;
      if (data !== sourceIds.length * selectedIds.size) throw new Error('Encaminhamento não confirmado');

      const msgCount = sourceIds.length;
      const convCount = selectedIds.size;
      toast({
        title: 'Mensagens reencaminhadas',
        description: `${msgCount} mensagem(ns) enviada(s) para ${convCount} conversa(s)`,
      });

      setSelectedIds(new Set());
      handleClose();
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível reencaminhar. A seleção foi mantida para tentares novamente.',
        variant: 'destructive',
      });
    } finally {
      forwardingRef.current = false;
      setForwarding(false);
    }
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchQuery('');
    onOpenChange(false);
    onClose?.();
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={() => { if (!forwardingRef.current) handleClose(); }}
      className="h-[75vh] rounded-t-3xl sm:max-w-lg"
      title={
        <span className="flex items-center gap-2">
          <Forward className="w-5 h-5" />
          Reencaminhar {sourceIds.length > 1 ? `${sourceIds.length} mensagens` : 'mensagem'}
        </span>
      }
    >

        {/* Message Preview */}
        {messagesToForward.length > 0 && (
          <div className="p-3 mb-4 rounded-xl bg-secondary/50 border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">A reencaminhar:</p>
            {messagesToForward.length === 1 ? (
              <p className="text-sm line-clamp-2">
                {messagesToForward[0].message_type === 'image'
                  ? '📷 Foto'
                  : messagesToForward[0].message_type === 'voice'
                  ? '🎤 Mensagem de voz'
                  : messagesToForward[0].message_type === 'video'
                  ? '🎥 Vídeo'
                  : messagesToForward[0].content || 'Mensagem'}
              </p>
            ) : (
              <p className="text-sm">
                {messagesToForward.length} mensagens selecionadas
              </p>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Procurar conversas..."
            className="pl-10 h-11 rounded-xl"
          />
        </div>

        {/* Conversation List */}
        <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto -mx-4" style={{ maxHeight: 'calc(75vh - 280px)' }}>
          {filteredConversations.map((conv) => {
            const otherParticipant = conv.participants?.find((p) => p.user_id !== user?.id)?.profile;
            const isGroup = conv.type === 'group';
            const displayName = isGroup ? conv.name || 'Grupo' : otherParticipant?.display_name || 'Desconhecido';
            const avatarUrl = isGroup ? conv.avatar_url : otherParticipant?.avatar_url;
            const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
            const isSelected = selectedIds.has(conv.id);

            return (
              <button
                key={conv.id}
                disabled={forwarding}
                aria-pressed={isSelected}
                onClick={() => toggleSelection(conv.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  isSelected ? 'bg-primary/10' : 'hover:bg-secondary/50'
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={avatarUrl || ''} />
                    <AvatarFallback className="bg-gradient-primary text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-white" />
                    </motion.div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <span className="font-semibold truncate block">{displayName}</span>
                  {conv.last_message && (
                    <span className="text-sm text-muted-foreground truncate block">
                      {conv.last_message.content || 'Media'}
                    </span>
                  )}
                </div>
                <span aria-hidden="true" className="w-5 h-5 shrink-0 rounded border border-primary">{isSelected && <Check className="w-4 h-4" />}</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-3 pt-4 border-t border-border mt-4"
          >
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selecionada(s)
              </span>
            </div>
            <Button variant="outline" onClick={handleClose} disabled={forwarding}>
              Cancelar
            </Button>
            <Button
              onClick={handleForward}
              disabled={forwarding || !sourceIds.length}
              className="bg-gradient-primary text-white"
            >
              {forwarding ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Forward className="w-4 h-4 mr-2" />
              )}
              Reencaminhar
            </Button>
          </motion.div>
        )}
    </ResponsiveModal>
  );
}
