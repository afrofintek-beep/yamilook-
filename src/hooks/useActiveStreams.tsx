import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActiveStream {
  id: string;
  title: string;
  viewer_count: number;
  host: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export function useActiveStreams() {
  const [activeCount, setActiveCount] = useState(0);
  const [activeStreams, setActiveStreams] = useState<ActiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  // Único por instância para não colidir no mesmo tópico do canal realtime.
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    const fetchActiveStreams = async () => {
      try {
        const { data, error } = await supabase
          .from('live_sessions')
          .select(`
            id,
            title,
            viewer_count,
            host:public_profiles!live_sessions_host_id_fkey(id, display_name, avatar_url)
          `)
          .eq('status', 'live')
          .order('viewer_count', { ascending: false })
          .limit(5);

        if (!error && data) {
          setActiveStreams(data as ActiveStream[]);
          setActiveCount(data.length);
        }
      } catch (error) {
        console.error('Error fetching active streams:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveStreams();

    // Subscribe to changes in live_sessions
    const channel = supabase
      .channel(`active-streams-count-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_sessions',
        },
        () => {
          fetchActiveStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { activeCount, activeStreams, hasActiveStreams: activeCount > 0, loading };
}
