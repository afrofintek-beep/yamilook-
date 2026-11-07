import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Radio, Square, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

type DebugEvent = {
  type: 'INSERT' | 'UPDATE';
  at: string;
  row: unknown;
};

export function CallSignalsDebugPanel() {
  useUiLocale();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [signals, setSignals] = useState<Tables<'call_signals'>[]>([]);

  const [listenStatus, setListenStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const runSelect = useCallback(async () => {
    if (!userId) {
      setSelectError('Not logged in');
      return;
    }

    setIsSelecting(true);
    setSelectError(null);

    console.log('[CallSignalsDebug] Running SELECT test for to_user_id:', userId);
    const { data, error } = await supabase
      .from('call_signals')
      .select('*')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[CallSignalsDebug] SELECT error:', error);
      setSelectError(`${error.message} (${error.code ?? 'no_code'})`);
      setSignals([]);
    } else {
      console.log('[CallSignalsDebug] SELECT ok, rows:', data?.length ?? 0, data);
      setSignals(data ?? []);
    }

    setIsSelecting(false);
  }, [userId]);

  const stopListening = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setListenStatus('idle');
  }, []);

  const startListening = useCallback(() => {
    if (!userId) {
      setListenStatus('error');
      console.error('[CallSignalsDebug] Cannot subscribe: not logged in');
      return;
    }

    // Ensure only one channel
    stopListening();
    setEvents([]);
    setListenStatus('subscribing');

    const channelName = `call-signals-debug-${userId}`;
    console.log('[CallSignalsDebug] Subscribing to Realtime channel:', channelName);
    console.log('[CallSignalsDebug] Filter: to_user_id=eq.' + userId);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `to_user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[CallSignalsDebug] Realtime INSERT:', payload);
          setEvents((prev) =>
            [{ type: 'INSERT' as const, at: new Date().toISOString(), row: payload.new }, ...prev].slice(0, 20)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_signals',
          filter: `to_user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[CallSignalsDebug] Realtime UPDATE:', payload);
          setEvents((prev) =>
            [{ type: 'UPDATE' as const, at: new Date().toISOString(), row: payload.new }, ...prev].slice(0, 20)
          );
        }
      )
      .subscribe((status, err) => {
        console.log('[CallSignalsDebug] Subscription status:', status, err ?? '');
        if (status === 'SUBSCRIBED') setListenStatus('subscribed');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setListenStatus('error');
      });

    channelRef.current = channel;
  }, [stopListening, userId]);

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  return (
    <div className="space-y-3 mb-6">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Activity className="h-4 w-4" />{uiText("call_signals Debug")}</h4>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={runSelect} disabled={!userId || isSelecting}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isSelecting ? 'animate-spin' : ''}`} />{uiText("SELECT (to_user_id)")}</Button>

        {listenStatus === 'subscribed' ? (
          <Button size="sm" variant="destructive" onClick={stopListening}>
            <Square className="h-4 w-4 mr-2" />{uiText("Parar listener")}</Button>
        ) : (
          <Button size="sm" onClick={startListening} disabled={!userId || listenStatus === 'subscribing'}>
            <Radio className="h-4 w-4 mr-2" />
            {listenStatus === 'subscribing' ? uiText("A subscrever…") : uiText("Iniciar listener")}
          </Button>
        )}

        <Badge variant="outline">
          {userId ? `user: ${userId.slice(0, 8)}…` : uiText("not logged in")}
        </Badge>

        <Badge variant={listenStatus === 'subscribed' ? 'default' : 'secondary'}>
          {listenStatus}
        </Badge>
      </div>

      {selectError && <p className="text-xs text-destructive">{uiText("SELECT error: ")}{selectError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground mb-2">{uiText("Últimos 20 sinais (SELECT)")}</p>
          <ScrollArea className="h-40">
            <pre className="text-[11px] font-mono whitespace-pre-wrap break-words">
              {signals.length ? JSON.stringify(signals, null, 2) : '—'}
            </pre>
          </ScrollArea>
        </div>

        <div className="p-3 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground mb-2">{uiText("Eventos Realtime (INSERT/UPDATE)")}</p>
          <ScrollArea className="h-40">
            <pre className="text-[11px] font-mono whitespace-pre-wrap break-words">
              {events.length ? JSON.stringify(events, null, 2) : '—'}
            </pre>
          </ScrollArea>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{uiText("Use isto para confirmar: (1) RLS permite o SELECT em call_signals para o utilizador atual; (2) eventos Realtime chegam quando outro utilizador envia sinais para o seu ")}<code className="font-mono">{uiText("to_user_id")}</code>.
      </p>
    </div>
  );
}
