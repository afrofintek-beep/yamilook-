import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Conversa {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  roomName: string;
  isHost: boolean;
}

/** Live conversas in a space that the user may see (RLS returns only their own
 *  and the ones they were individually invited to). */
export function useSpaceConversas(space: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['mokubico-conversas', space, user?.id],
    enabled: !!user,
    // Live state must not inherit the feed's five-minute freshness window.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mokubico_conversas')
        .select('id, title, host_id, livekit_room_name')
        .eq('space', space)
        .eq('status', 'live')
        .order('started_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      if (!data?.length) return [] as Conversa[];

      const hostIds = [...new Set(data.map((c) => c.host_id))];
      const { data: profiles } = await supabase.rpc('get_public_profiles_by_ids', { p_ids: hostIds });
      const names = new Map<string, string>();
      for (const p of profiles ?? []) names.set(p.id, p.display_name || 'Anónimo');

      return data.map((c): Conversa => ({
        id: c.id,
        title: c.title || 'Conversa',
        hostId: c.host_id,
        hostName: names.get(c.host_id) ?? 'Anónimo',
        roomName: c.livekit_room_name,
        isHost: c.host_id === user!.id,
      }));
    },
  });
}

/** Confirm the write before removing a conversa from the live lists. */
export function useEndConversa() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('mokubico_conversas')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', id)
        .eq('host_id', user.id)
        .select('id')
        .single();
      if (error) throw error;
      // A write blocked by RLS can affect no rows. Do not report success.
      if (!data) throw new Error('Não foi possível confirmar o encerramento.');
      return data.id;
    },
    onSuccess: async (id) => {
      // An older in-flight read must not put the ended room back into cache.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['mokubico-conversas'] }),
        queryClient.cancelQueries({ queryKey: ['mokubico-live-spaces'] }),
      ]);
      queryClient.setQueriesData<Conversa[]>(
        { queryKey: ['mokubico-conversas'] },
        (previous) => previous?.filter((conversa) => conversa.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: ['mokubico-conversas'] });
      // A space may contain other live rooms: fetch the badge state afresh.
      void queryClient.resetQueries({ queryKey: ['mokubico-live-spaces'] });
    },
  });
}

/** Open a free conversa in a space with an individually-chosen guest list.
 *  Returns the new conversa id (navigate to its room). */
export function useOpenConversa() {
  const { user } = useAuth();
  return useCallback(
    async ({ space, title, guestIds }: { space: string; title: string; guestIds: string[] }) => {
      if (!user) throw new Error('Not authenticated');

      // Limit: one live conversa per host. If one's already open, reuse it.
      const { data: existing } = await supabase
        .from('mokubico_conversas')
        .select('id')
        .eq('host_id', user.id)
        .eq('status', 'live')
        .limit(1)
        .maybeSingle();
      if (existing) return { id: existing.id as string, existing: true };

      const { data: ub } = await supabase
        .from('user_bandas').select('banda_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle();

      // Quintal voice/video is a Pro feature; free Quintal is text-only. Other
      // spaces include voice/video for free. is_pro respects the subscription
      // expiry (an expired Pro no longer unlocks media).
      const { data: proData } = await supabase.rpc('is_pro', {});
      const isPro = proData === true;
      const mediaEnabled = space !== 'quintal' || isPro;

      const roomName = `mok-${user.id}-${Date.now()}`;
      const { data: conversa, error } = await supabase
        .from('mokubico_conversas')
        .insert({ host_id: user.id, banda_id: ub?.banda_id ?? null, space, title: title || null, livekit_room_name: roomName, media_enabled: mediaEnabled })
        .select('id')
        .single();
      if (error) throw error;

      // Limits per space: Quarto 1:1 (host+1); Quintal huge (host+99, text);
      // Sala/Cozinha up to 8 (host+7).
      const cap = space === 'quarto' ? 1 : space === 'quintal' ? 99 : 7;
      const guests = guestIds.slice(0, cap);
      if (guests.length > 0) {
        await supabase
          .from('mokubico_conversa_guests')
          .insert(guests.map((uid) => ({ conversa_id: conversa.id, user_id: uid })));
      }
      return { id: conversa.id as string, existing: false };
    },
    [user],
  );
}
