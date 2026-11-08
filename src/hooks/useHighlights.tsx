import { uiText } from '@/i18n/ui-copy';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Highlight {
  id: string;
  user_id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
  display_order: number;
}

export interface HighlightItem {
  id: string;
  highlight_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  display_order: number;
}

export function useHighlights(userId?: string) {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const targetUserId = userId || user?.id;

  const fetchHighlights = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('profile_highlights')
        .select('*')
        .eq('user_id', targetUserId)
        .order('display_order', { ascending: true });

      if (fetchError) throw fetchError;
      setHighlights((data as Highlight[]) || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const createHighlight = async (title: string, coverFile?: File) => {
    if (!user) throw new Error(uiText("Not authenticated"));

    let coverUrl: string | null = null;

    if (coverFile) {
      const fileExt = coverFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('highlights')
        .upload(fileName, coverFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('highlights')
        .getPublicUrl(fileName);

      coverUrl = publicUrl;
    }

    const { data, error } = await supabase
      .from('profile_highlights')
      .insert({
        user_id: user.id,
        title,
        cover_url: coverUrl,
        display_order: highlights.length,
      })
      .select()
      .single();

    if (error) throw error;

    setHighlights(prev => [...prev, data as Highlight]);
    return data as Highlight;
  };

  const updateHighlight = async (id: string, updates: Partial<Pick<Highlight, 'title' | 'cover_url'>>) => {
    const { data, error } = await supabase
      .from('profile_highlights')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    setHighlights(prev => prev.map(h => h.id === id ? data as Highlight : h));
    return data as Highlight;
  };

  const deleteHighlight = async (id: string) => {
    const { error } = await supabase
      .from('profile_highlights')
      .delete()
      .eq('id', id);

    if (error) throw error;

    setHighlights(prev => prev.filter(h => h.id !== id));
  };

  const reorderHighlights = async (orderedIds: string[]) => {
    if (!user) throw new Error(uiText("Not authenticated"));

    // Optimistic update
    const reordered = orderedIds
      .map((id, index) => {
        const highlight = highlights.find(h => h.id === id);
        return highlight ? { ...highlight, display_order: index } : null;
      })
      .filter(Boolean) as Highlight[];

    setHighlights(reordered);

    // Persist to database
    const updates = orderedIds.map((id, index) =>
      supabase
        .from('profile_highlights')
        .update({ display_order: index })
        .eq('id', id)
    );

    await Promise.all(updates);
  };

  const addItemToHighlight = async (highlightId: string, file: File, caption?: string) => {
    if (!user) throw new Error(uiText("Not authenticated"));

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${highlightId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('highlights')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('highlights')
      .getPublicUrl(fileName);

    const { data, error } = await supabase
      .from('profile_highlight_items')
      .insert({
        highlight_id: highlightId,
        media_url: publicUrl,
        media_type: file.type.startsWith('video') ? 'video' : 'image',
        caption,
      })
      .select()
      .single();

    if (error) throw error;

    // Update cover if first item
    const highlight = highlights.find(h => h.id === highlightId);
    if (highlight && !highlight.cover_url) {
      await updateHighlight(highlightId, { cover_url: publicUrl });
    }

    return data as HighlightItem;
  };

  const getHighlightItems = async (highlightId: string): Promise<HighlightItem[]> => {
    const { data, error } = await supabase
      .from('profile_highlight_items')
      .select('*')
      .eq('highlight_id', highlightId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return (data as HighlightItem[]) || [];
  };

  return {
    highlights,
    loading,
    error,
    refresh: fetchHighlights,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    reorderHighlights,
    addItemToHighlight,
    getHighlightItems,
  };
}
