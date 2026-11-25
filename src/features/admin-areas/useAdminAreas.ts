import { useEffect, useState } from 'react';
import { onlineManager, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { getAdminAreaAccess } from './api';
import { adminAreaKeys, type AdminArea } from './catalog';

/** One server-owned decision shared by both apps, with no persistent browser grant. */
export function useAdminAreas() {
  const { user } = useAuth();
  const userId = user?.id;
  const [connection, setConnection] = useState(() => ({
    online: onlineManager.isOnline() && navigator.onLine !== false,
    verifyAfter: 0,
  }));
  useEffect(() => onlineManager.subscribe(online => {
    // A paused query can retain successful data. Require a fresh check on return.
    setConnection({ online, verifyAfter: Date.now() });
  }), []);
  const query = useQuery({
    queryKey: ['admin-area-access', userId, user?.last_sign_in_at],
    queryFn: async ({ signal }) => {
      const access = await getAdminAreaAccess(signal);
      if (access.userId !== userId) throw new Error('integration_access_account_changed');
      return access;
    },
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 15_000,
  });
  const confirmed = !!userId && connection.online && query.fetchStatus !== 'paused'
    && query.dataUpdatedAt >= connection.verifyAfter && query.isSuccess && query.isFetchedAfterMount
    && query.data?.userId === userId;
  return {
    allowed: Object.fromEntries(adminAreaKeys.map(key => [key, confirmed && query.data?.areas[key] === true])) as Record<AdminArea, boolean>,
    any: confirmed && adminAreaKeys.some(key => query.data?.areas[key] === true),
    admin: confirmed && query.data?.admin === true,
    loading: !!userId && (query.isPending || !query.isFetchedAfterMount),
    error: query.error,
    retry: query.refetch,
  };
}
