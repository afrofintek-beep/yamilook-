import { uiText } from '@/i18n/ui-copy';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface CloseFriend {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
}

export function useCloseFriends() {
  const { user } = useAuth();
  const [closeFriends, setCloseFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCloseFriends = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('close_friends')
        .select('friend_id')
        .eq('user_id', user.id);

      if (error) throw error;

      setCloseFriends(data?.map(cf => cf.friend_id) || []);
    } catch (err) {
      console.error('Failed to fetch close friends:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCloseFriends();
  }, [fetchCloseFriends]);

  const addCloseFriend = async (friendId: string) => {
    if (!user) return { error: new Error(uiText("Not authenticated")) };

    const { error } = await supabase
      .from('close_friends')
      .insert({ user_id: user.id, friend_id: friendId });

    if (!error) {
      setCloseFriends(prev => [...prev, friendId]);
    }

    return { error: error ? new Error(error.message) : null };
  };

  const removeCloseFriend = async (friendId: string) => {
    if (!user) return { error: new Error(uiText("Not authenticated")) };

    const { error } = await supabase
      .from('close_friends')
      .delete()
      .eq('user_id', user.id)
      .eq('friend_id', friendId);

    if (!error) {
      setCloseFriends(prev => prev.filter(id => id !== friendId));
    }

    return { error: error ? new Error(error.message) : null };
  };

  const toggleCloseFriend = async (friendId: string) => {
    if (closeFriends.includes(friendId)) {
      return removeCloseFriend(friendId);
    } else {
      return addCloseFriend(friendId);
    }
  };

  const isCloseFriend = (friendId: string) => {
    return closeFriends.includes(friendId);
  };

  return {
    closeFriends,
    loading,
    addCloseFriend,
    removeCloseFriend,
    toggleCloseFriend,
    isCloseFriend,
    refresh: fetchCloseFriends,
  };
}
