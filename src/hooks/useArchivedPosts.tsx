import { uiText } from '@/i18n/ui-copy';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export function useArchivedPosts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [archivedPostIds, setArchivedPostIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchArchivedIds = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('post_archives')
      .select('post_id')
      .eq('user_id', user.id);

    if (!error && data) {
      setArchivedPostIds(new Set(data.map(d => d.post_id)));
    }
  }, [user]);

  const toggleArchive = useCallback(async (postId: string) => {
    if (!user) return;

    const isCurrentlyArchived = archivedPostIds.has(postId);

    // Optimistic update
    setArchivedPostIds(prev => {
      const next = new Set(prev);
      if (isCurrentlyArchived) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    try {
      if (isCurrentlyArchived) {
        const { error } = await supabase
          .from('post_archives')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
        toast({ title: uiText("Publicação desarquivada") });
      } else {
        const { error } = await supabase
          .from('post_archives')
          .insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
        toast({ title: uiText("Publicação arquivada") });
      }
    } catch (err) {
      // Revert on failure
      setArchivedPostIds(prev => {
        const next = new Set(prev);
        if (isCurrentlyArchived) {
          next.add(postId);
        } else {
          next.delete(postId);
        }
        return next;
      });
      toast({ title: uiText("Erro"), description: uiText("Não foi possível atualizar o arquivo"), variant: 'destructive' });
    }
  }, [user, archivedPostIds, toast]);

  const isArchived = useCallback((postId: string) => {
    return archivedPostIds.has(postId);
  }, [archivedPostIds]);

  return {
    archivedPostIds,
    fetchArchivedIds,
    toggleArchive,
    isArchived,
    loading,
  };
}
