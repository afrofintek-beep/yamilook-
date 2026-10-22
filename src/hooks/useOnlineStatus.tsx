import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables } from '@/integrations/supabase/types';
import { isRecentlyOnline } from '@/lib/online-presence';
import { usePresenceClock } from './usePresenceClock';
import { logger } from '@/lib/logger';

interface UserStatus {
  is_online: boolean;
  last_seen: string | null;
  show_online_status: boolean;
  show_last_seen: boolean;
}

/** A visible browser renews an authenticated, server-timed lease every 30 seconds. */
export function useOnlineStatus() {
  const { user } = useAuth();
  const userId = user?.id;
  const clientId = useRef(crypto.randomUUID());
  const queue = useRef(Promise.resolve());
  const persistStatus = useCallback((active: boolean) => {
    if (!userId) return Promise.resolve();
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (active && (document.hidden || !navigator.onLine)) return;
      const client = supabase as unknown as {
        rpc: (name: 'renew_online_presence', args: { p_client_id: string; p_active: boolean }) => PromiseLike<{ error: { message: string } | null }>;
      };
      const { error } = await client.rpc('renew_online_presence', { p_client_id: clientId.current, p_active: active });
      if (error) logger.error('Failed to renew presence', 'presence', error);
    }).catch((error) => { logger.error('Failed to renew presence', 'presence', error); });
    return queue.current;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let initialized = false;
    let wantsOnline = false;
    const sync = () => {
      if (!disposed && initialized) void persistStatus(wantsOnline && !document.hidden && navigator.onLine);
    };
    const init = async () => {
      const { data, error } = await supabase.from('profiles').select('show_online_status').eq('id', userId).single();
      if (disposed) return;
      wantsOnline = !error && !!data && data.show_online_status !== false;
      initialized = true;
      sync();
    };
    void init().catch((error) => logger.error('Failed to initialize presence', 'presence', error));
    const channel = supabase.channel(`presence-preference-${userId}-${clientId.current}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, (payload) => {
        const preference = (payload.new as Tables<'profiles'>).show_online_status;
        // Heartbeats also update profiles: only react when the preference changes.
        if (typeof preference === 'boolean' && preference !== wantsOnline) {
          wantsOnline = preference;
          initialized = true;
          sync();
        }
      }).subscribe();
    const timer = window.setInterval(() => {
      if (!document.hidden && navigator.onLine && wantsOnline) sync();
    }, 30_000);
    const hide = () => { void persistStatus(false); };
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', sync);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', sync);
      void supabase.removeChannel(channel);
      void persistStatus(false);
    };
  }, [userId, persistStatus]);
  return { persistStatus };
}

/**
 * Reads server-confirmed presence and expires it locally if updates stop.
 */
export function useUserStatus(userId: string | null) {
  const now = usePresenceClock();
  const [status, setStatus] = useState<UserStatus>({
    is_online: false,
    last_seen: null,
    show_online_status: true,
    show_last_seen: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_online, last_seen, show_online_status, show_last_seen')
          .eq('id', userId)
          .single();

        if (data && !error) {
          setStatus({
            is_online: data.is_online ?? false,
            last_seen: data.last_seen,
            show_online_status: data.show_online_status ?? true,
            show_last_seen: data.show_last_seen ?? true,
          });
        }
      } catch (error) {
        logger.error('Error fetching user status', 'presence', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    // Receive server lease changes; local expiry also handles missed updates.

    // DB subscription for privacy setting changes
    const dbChannel = supabase
      .channel(`user-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const { is_online, last_seen, show_online_status, show_last_seen } = payload.new as Tables<'profiles'>;
          setStatus({
            is_online: is_online ?? false,
            last_seen,
            show_online_status: show_online_status ?? true,
            show_last_seen: show_last_seen ?? true,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
    };
  }, [userId]);

  return { ...status, is_online: status.show_online_status && isRecentlyOnline(status.is_online, status.last_seen, now), loading };
}

export function useMultipleUserStatus(userIds: string[]) {
  const now = usePresenceClock();
  const [statuses, setStatuses] = useState<Record<string, UserStatus>>({});
  const [loading, setLoading] = useState(true);
  // Único por instância para não colidir no mesmo tópico do canal realtime.
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (userIds.length === 0) {
      setStatuses({});
      setLoading(false);
      return;
    }

    const fetchStatuses = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, is_online, last_seen, show_online_status, show_last_seen')
          .in('id', userIds);

        if (data && !error) {
          const statusMap: Record<string, UserStatus> = {};
          data.forEach((profile) => {
            statusMap[profile.id] = {
              is_online: profile.is_online ?? false,
              last_seen: profile.last_seen,
              show_online_status: profile.show_online_status ?? true,
              show_last_seen: profile.show_last_seen ?? true,
            };
          });
          setStatuses(statusMap);
        }
      } catch (error) {
        logger.error('Error fetching user statuses', 'presence', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatuses();

    // Receive server lease changes; local expiry also handles missed updates.

    // DB subscription for full profile changes
    const dbChannel = supabase
      .channel(`multi-user-status-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          const { id, is_online, last_seen, show_online_status, show_last_seen } = payload.new as Tables<'profiles'>;
          if (userIds.includes(id)) {
            setStatuses((prev) => ({
              ...prev,
              [id]: {
                is_online: is_online ?? false,
                last_seen,
                show_online_status: show_online_status ?? true,
                show_last_seen: show_last_seen ?? true,
              },
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
    };
  }, [userIds.join(',')]);

  return { statuses: Object.fromEntries(Object.entries(statuses).map(([id, status]) => [id, { ...status, is_online: status.show_online_status && isRecentlyOnline(status.is_online, status.last_seen, now) }])), loading };
}
