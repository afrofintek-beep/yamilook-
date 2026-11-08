import { uiText } from '@/i18n/ui-copy';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HiddenMessageState {
  is_hidden: boolean;
  is_archived: boolean;
}

export function useHiddenMessages(userId: string | undefined) {
  const { toast } = useToast();
  const [hiddenMessages, setHiddenMessages] = useState<Record<string, HiddenMessageState>>({});

  const fetchHiddenMessages = useCallback(async (messageIds: string[]) => {
    if (!userId || messageIds.length === 0) return;

    const { data, error } = await supabase
      .from('hidden_messages')
      .select('message_id, is_hidden, is_archived')
      .eq('user_id', userId)
      .in('message_id', messageIds);

    if (error) {
      console.error('Error fetching hidden messages:', error);
      return;
    }

    const stateMap: Record<string, HiddenMessageState> = {};
    data?.forEach((item) => {
      stateMap[item.message_id] = {
        is_hidden: item.is_hidden,
        is_archived: item.is_archived,
      };
    });
    setHiddenMessages(stateMap);
  }, [userId]);

  const toggleHide = useCallback(async (messageId: string) => {
    if (!userId) return;

    const current = hiddenMessages[messageId];
    const newHiddenState = !current?.is_hidden;

    const { error } = await supabase
      .from('hidden_messages')
      .upsert({
        user_id: userId,
        message_id: messageId,
        is_hidden: newHiddenState,
        is_archived: current?.is_archived ?? false,
      }, {
        onConflict: 'user_id,message_id',
      });

    if (error) {
      toast({ title: uiText("Erro"), description: error.message, variant: 'destructive' });
      return;
    }

    setHiddenMessages((prev) => ({
      ...prev,
      [messageId]: {
        is_hidden: newHiddenState,
        is_archived: prev[messageId]?.is_archived ?? false,
      },
    }));

    toast({ title: newHiddenState ? 'Mensagem oculta' : 'Mensagem visível' });
  }, [userId, hiddenMessages, toast]);

  const toggleArchive = useCallback(async (messageId: string) => {
    if (!userId) return;

    const current = hiddenMessages[messageId];
    const newArchivedState = !current?.is_archived;

    const { error } = await supabase
      .from('hidden_messages')
      .upsert({
        user_id: userId,
        message_id: messageId,
        is_hidden: current?.is_hidden ?? false,
        is_archived: newArchivedState,
      }, {
        onConflict: 'user_id,message_id',
      });

    if (error) {
      toast({ title: uiText("Erro"), description: error.message, variant: 'destructive' });
      return;
    }

    setHiddenMessages((prev) => ({
      ...prev,
      [messageId]: {
        is_hidden: prev[messageId]?.is_hidden ?? false,
        is_archived: newArchivedState,
      },
    }));

    toast({ title: newArchivedState ? 'Mensagem arquivada' : 'Mensagem desarquivada' });
  }, [userId, hiddenMessages, toast]);

  const isHidden = useCallback((messageId: string) => {
    return hiddenMessages[messageId]?.is_hidden ?? false;
  }, [hiddenMessages]);

  const isArchived = useCallback((messageId: string) => {
    return hiddenMessages[messageId]?.is_archived ?? false;
  }, [hiddenMessages]);

  return {
    hiddenMessages,
    fetchHiddenMessages,
    toggleHide,
    toggleArchive,
    isHidden,
    isArchived,
  };
}
