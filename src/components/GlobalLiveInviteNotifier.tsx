import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

/**
 * Global: alerts the user when a host invites them to a live (live_access
 * status 'invited'). Tapping "Entrar" opens the live, where they accept.
 */
export function GlobalLiveInviteNotifier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`live-invites-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_access', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const row = payload.new as { session_id: string; status: string } | undefined;
          if (!row || row.status !== 'invited') return;
          if (seenRef.current.has(row.session_id)) return;
          seenRef.current.add(row.session_id);

          const { data } = await supabase
            .from('live_sessions')
            .select('id, title, status, host:public_profiles!live_sessions_host_id_fkey(display_name)')
            .eq('id', row.session_id)
            .maybeSingle();
          if (!data || data.status !== 'live') return;

          const host = (data.host as { display_name?: string } | null)?.display_name ?? 'Alguém';
          toast(`${host} convidou-te para a live`, {
            description: data.title || 'Live da banda',
            duration: 12000,
            action: { label: 'Entrar', onClick: () => navigate(`/live/${row.session_id}`) },
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, navigate]);

  return null;
}
