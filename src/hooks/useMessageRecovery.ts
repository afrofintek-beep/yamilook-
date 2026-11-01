import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type MessageVersion = { id: string; updated_at: string };

/** A small, RLS-protected probe recovers messages after a lost realtime event. */
export function useMessageRecovery(
  conversationId: string | null,
  userId: string | undefined,
  messages: MessageVersion[],
  refresh: (markRead?: boolean) => Promise<void>,
) {
  const current = useRef({ messages, refresh });
  current.current = { messages, refresh };

  useEffect(() => {
    if (!conversationId || !userId) return;
    let stopped = false;
    let pending = false;
    const probe = async () => {
      if (stopped || pending || document.visibilityState === 'hidden' || !navigator.onLine) return;
      pending = true;
      try {
        const { data, error } = await supabase.from('visible_messages')
          .select('id, updated_at').eq('conversation_id', conversationId)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1);
        if (stopped || error || !data?.length) return;
        const latest = data[0];
        const known = current.current.messages.find(message => message.id === latest.id);
        if (!known || known.updated_at !== latest.updated_at) await current.current.refresh(false);
      } catch (error) {
        console.error('Error recovering chat messages:', error);
      } finally {
        pending = false;
      }
    };
    const timer = window.setInterval(() => { void probe(); }, 5000);
    const resume = () => { void probe(); };
    window.addEventListener('online', resume);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('online', resume);
      window.removeEventListener('pageshow', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [conversationId, userId]);
}
