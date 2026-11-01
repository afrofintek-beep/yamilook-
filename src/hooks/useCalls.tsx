/* @refresh reset */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useIncomingCallSignals } from './useIncomingCallSignals';
import { logger } from '@/lib/logger';
import { fetchPublicProfilesBatched } from '@/lib/public-profile-batch';
import { attachCallParticipants } from '@/lib/call-history';
import { shouldPollIncomingCall } from '@/lib/incoming-call-polling';
import { reconcileDirectCalls } from '@/lib/direct-call-reconciliation';
import { useScheduledCalls } from '@/features/scheduled-calls/useScheduledCalls';
export type { ScheduledCall } from '@/features/scheduled-calls/api';

export interface Call {
  id: string;
  type: 'voice' | 'video';
  status: string;
  initiator_id: string;
  is_group_call: boolean;
  conversation_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  max_participants: number;
  is_locked: boolean;
  waiting_room_enabled: boolean;
  recording_enabled: boolean;
  created_at: string;
}

export interface CallParticipant {
  id: string;
  call_id: string;
  user_id: string;
  role: 'host' | 'co_host' | 'participant';
  status: string;
  is_muted: boolean;
  is_video_enabled: boolean;
  is_screen_sharing: boolean;
  is_hand_raised: boolean;
  is_spotlight: boolean;
  joined_at: string | null;
  left_at: string | null;
  virtual_background: string | null;
}

export interface CallHistory {
  id: string;
  type: 'voice' | 'video';
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  is_group_call: boolean;
  end_reason?: string | null;
  caller_id: string | null;
  callee_id: string | null;
  initiator_id: string;
  participants: {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  }[];
}

export function useCalls({ loadHistory = true }: { loadHistory?: boolean } = {}) {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  // Per-instance suffix so multiple mounted useCalls() (ActiveCallProvider,
  // CallsTabContent, Calls page…) don't collide on one shared realtime topic.
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));
  const [callHistory, setCallHistory] = useState<CallHistory[]>([]);
  const scheduling = useScheduledCalls();
  const scheduledCalls = scheduling.scheduledCalls;
  const [loading, setLoading] = useState(true);

  // Keep a ref so effects don't need to re-subscribe when incomingCall changes
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  // ============================================================
  // INCOMING CALL SIGNALS LISTENER
  // This subscribes to call_signals by to_user_id ONLY,
  // so we can detect incoming offers before knowing the call_id.
  // ============================================================
  
  // Stable reference for the offer handler to prevent hook re-initialization
  const handleIncomingOfferRef = useRef<((offer: {
    callId: string;
    callType: 'voice' | 'video';
    callerId: string;
    sdp: RTCSessionDescriptionInit;
  }) => Promise<void>) | null>(null);

  handleIncomingOfferRef.current = async (offer) => {
    // If we already have an incoming call displayed, ignore new offers
    if (incomingCallRef.current) {
      logger.debug('Already have incoming call, ignoring new offer', 'useCalls');
      return;
    }

    logger.debug('Received incoming offer for call', 'useCalls', { callId: offer.callId, callerId: offer.callerId });

    try {
      // Fetch the call details from the database
      const { data: call, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', offer.callId)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching call', 'useCalls', error);
        return;
      }

      if (!call) {
        logger.debug('Call not found in database', 'useCalls', offer.callId);
        return;
      }

      // Only show if call is still ringing
      if (call.status !== 'ringing' && call.status !== 'initiated') {
        logger.debug('Call status is not ringing', 'useCalls', call.status);
        return;
      }

      logger.debug('Setting incoming call from WebRTC offer', 'useCalls', call.id);
      setIncomingCall({
        id: call.id,
        type: call.type as 'voice' | 'video',
        status: call.status,
        initiator_id: call.initiator_id,
        is_group_call: call.is_group_call,
        conversation_id: call.conversation_id,
        started_at: call.started_at,
        ended_at: call.ended_at,
        duration_seconds: call.duration_seconds,
        max_participants: call.max_participants,
        is_locked: call.is_locked,
        waiting_room_enabled: call.waiting_room_enabled,
        recording_enabled: call.recording_enabled,
        created_at: call.created_at,
      });
    } catch (err) {
      logger.error('Error handling incoming offer', 'useCalls', err);
    }
  };

  // Memoized stable callback that won't change between renders
  const stableOfferHandler = useMemo(() => ({
    onOfferReceived: (offer: {
      callId: string;
      callType: 'voice' | 'video';
      callerId: string;
      sdp: RTCSessionDescriptionInit;
    }): void => {
      void handleIncomingOfferRef.current?.(offer);
    }
  }), []);

  // Use the incoming call signals hook with stable callback
  useIncomingCallSignals(stableOfferHandler);

  // Do not fetch history for the app-wide incoming-call listener. The calls page
  // opts into this read; realtime incoming call handling always remains active.
  const fetchCallHistory = useCallback(async () => {
    if (!user) return;
    try {
      const { data: participations, error } = await supabase
        .from('call_participants')
        .select(`
          call_id,
          calls (
            id, type, status, started_at, ended_at, duration_seconds,
            is_group_call, caller_id, callee_id, initiator_id, end_reason
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!participations) return;
      const callRecords = participations.flatMap(row =>
        row.calls ? [row.calls as Omit<CallHistory, 'participants'>] : []
      );
      if (!callRecords.length) {
        setCallHistory([]);
        return;
      }

      // One participant query for all history records, not one per call.
      const callIds = [...new Set(callRecords.map(call => call.id))];
      const { data: participants, error: participantError } = await supabase
        .from('call_participants')
        .select('call_id, user_id')
        .in('call_id', callIds)
        .neq('user_id', user.id);
      if (participantError) throw participantError;

      const participantIds = participants?.map(participant => participant.user_id) ?? [];
      const fallbackIds = callRecords.flatMap(call => {
        const otherId = call.caller_id === user.id ? call.callee_id : call.caller_id;
        return otherId ? [otherId] : [];
      });
      const { data: profiles, error: profilesError } =
        await fetchPublicProfilesBatched([...new Set([...participantIds, ...fallbackIds])]);
      if (profilesError) throw profilesError;

      setCallHistory(attachCallParticipants(
        callRecords, participants ?? [], profiles ?? [], user.id
      ) as CallHistory[]);
    } catch (error) {
      logger.error('Error fetching call history', 'useCalls', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateRsvp = scheduling.rsvp;
  const cancelScheduledCall = scheduling.cancel;
  const fetchScheduledCalls = scheduling.refetch;

  // Get call statistics
  const getCallStatistics = useCallback(async (period: 'week' | 'month' | 'all') => {
    if (!user) return null;

    let startDate: Date;
    const now = new Date();

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        startDate = new Date(0);
    }

    const { data } = await supabase
      .from('call_participants')
      .select(`
        calls (
          type,
          duration_seconds,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString());

    if (!data) return null;

    const stats = data.reduce((acc, p) => {
      const call = p.calls as {
        type: string;
        duration_seconds: number | null;
        created_at: string;
      } | null;
      if (!call) return acc;

      acc.totalCalls++;
      acc.totalDuration += call.duration_seconds || 0;
      if (call.type === 'video') acc.videoCalls++;
      else acc.voiceCalls++;
      return acc;
    }, { totalCalls: 0, totalDuration: 0, videoCalls: 0, voiceCalls: 0 });

    return stats;
  }, [user]);

  // Run periodic cleanup of stuck calls on mount
  useEffect(() => {
    if (!user) return;
    // Room presence is authoritative. A long/hidden call is not a stuck call.
    void reconcileDirectCalls();
  }, [user]);

  // Watch the active incoming call record - clear it if A hangs up before B answers
  useEffect(() => {
    if (!incomingCall) return;
    let disposed = false;

    // Poll the call status every 2s as a fallback (Realtime may be slow)
    const intervalId = setInterval(async () => {
      const { data } = await supabase
        .from('calls')
        .select('status')
        .eq('id', incomingCall.id)
        .maybeSingle();

      if (disposed) return;
      if (!data || ['ended', 'declined', 'failed', 'cancelled', 'missed', 'connecting', 'ongoing'].includes(data.status)) {
        logger.debug('Active incoming call is no longer ringing - clearing', 'useCalls', data?.status);
        setIncomingCall(null);
      }
    }, 2000);

    // Supabase reuses a channel with the same topic. The global call listener
    // and the history page can both watch this call, so each effect needs its
    // own topic, including when a previous asynchronous unsubscribe is pending.
    const channel = supabase
      .channel(`call-status-watch-${incomingCall.id}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `id=eq.${incomingCall.id}`,
        },
        (payload) => {
          if (disposed) return;
          const newStatus = (payload.new as Partial<Tables<'calls'>>)?.status;
          logger.debug('Incoming call status changed', 'useCalls', newStatus);
          if (newStatus && ['ended', 'declined', 'failed', 'cancelled', 'missed', 'connecting', 'ongoing'].includes(newStatus)) {
            logger.debug('Clearing incoming call - caller hung up', 'useCalls');
            setIncomingCall(null);
          }
        }
      )
      .subscribe();

    return () => {
      disposed = true;
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [incomingCall?.id]);

  // Listen for incoming calls with fallback polling for reliability
  useEffect(() => {
    if (!user) return;

    let pollIntervalId: ReturnType<typeof setInterval> | null = null;
    let channelRemoved = false;
    let channelHealthy = false;
    let lastPollAt = 0;
    let checkInFlight = false;

    // Poll for incoming calls – works even if Realtime is delayed/broken
    // Call timeout: 90 seconds (matches DB cleanup function)
    const CALL_TIMEOUT_MS = 90 * 1000;

    const checkForRingingCall = async () => {
      // Don't poll if we already have an incoming call displayed (handled by the watcher above)
      if (incomingCallRef.current || checkInFlight) return;
      checkInFlight = true;
      lastPollAt = Date.now();

      try {
        const { data: participant, error } = await supabase
          .from('call_participants')
          .select('call_id, status, created_at')
          .eq('user_id', user.id)
          .eq('status', 'ringing')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          logger.error('Error polling for ringing calls', 'useCalls', error);
          return;
        }

        if (!participant?.call_id) return;

        // Check if call is stale (older than timeout)
        const callAge = Date.now() - new Date(participant.created_at).getTime();
        if (callAge > CALL_TIMEOUT_MS) {
          logger.debug('Ignoring stale ringing call', 'useCalls', { callId: participant.call_id, ageSeconds: Math.round(callAge / 1000) });
          // Mark participant as missed and call as ended
          await Promise.all([
            supabase
              .from('call_participants')
              .update({ status: 'declined', left_at: new Date().toISOString() })
              .eq('call_id', participant.call_id)
              .eq('user_id', user.id)
              .eq('status', 'ringing'),
            supabase
              .from('calls')
              .update({ status: 'ended', ended_at: new Date().toISOString(), end_reason: 'no_answer' })
              .eq('id', participant.call_id)
              .eq('status', 'ringing'),
          ]);
          return;
        }

        // Also verify call is still actually ringing in the calls table
        const { data: callCheck } = await supabase
          .from('calls')
          .select('status')
          .eq('id', participant.call_id)
          .maybeSingle();
        
        if (!callCheck || callCheck.status !== 'ringing') {
          logger.debug('Call is no longer ringing, skipping', 'useCalls', participant.call_id);
          return;
        }

        logger.debug('Found ringing participant via poll', 'useCalls', participant.call_id);

        const { data: call } = await supabase
          .from('calls')
          .select('*')
          .eq('id', participant.call_id)
          .maybeSingle();

        if (call && call.status === 'ringing') {
          logger.debug('Setting incoming call from poll', 'useCalls', call.id);
          setIncomingCall(call as Call);
        }
      } catch (error) {
        logger.error('Error in checkForRingingCall', 'useCalls', error);
      } finally {
        checkInFlight = false;
      }
    };

    const onPushClick = (event: MessageEvent) => {
      if (event.data?.type === 'kosolola:incoming-call') void checkForRingingCall();
    };
    navigator.serviceWorker?.addEventListener('message', onPushClick);

    // Realtime is primary; poll fast only when it is unavailable. Retain a
    // slow safety check when subscribed, and recover promptly on foreground.
    const pollIfDue = () => {
      if (shouldPollIncomingCall({
        now: Date.now(),
        lastCheckAt: lastPollAt,
        subscribed: channelHealthy,
        visible: document.visibilityState === 'visible',
      })) void checkForRingingCall();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForRingingCall();
    };
    const onOnline = () => { void checkForRingingCall(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    void checkForRingingCall();
    pollIntervalId = setInterval(pollIfDue, 2000);

    // Also subscribe to Realtime for faster detection when available
    const channel = supabase
      .channel(`incoming-calls-${user.id}-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_participants',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          logger.debug('Realtime event', 'useCalls', { eventType: payload.eventType, new: payload.new });
          const participant = payload.new as CallParticipant;

          // Handle new ringing status
          if (participant?.status === 'ringing') {
            // Don't re-surface the overlay if a call is already ringing (mirrors
            // the poll guard); avoids re-entering answerCall on a stale offer.
            if (incomingCallRef.current) return;
            logger.debug('Realtime: participant ringing', 'useCalls', participant.call_id);

            const { data: call } = await supabase
              .from('calls')
              .select('*')
              .eq('id', participant.call_id)
              .maybeSingle();

            if (call && call.status === 'ringing') {
              logger.debug('Setting incoming call from Realtime', 'useCalls', call.id);
              setIncomingCall(call as Call);
            }
          }

          // Handle call ended/declined/connected - clear incoming call
          if (participant?.status && ['connected', 'declined', 'left', 'ended'].includes(participant.status)) {
            logger.debug('Realtime: call status changed - clearing incoming call', 'useCalls', participant.status);
            setIncomingCall(null);
          }
        }
      )
      .subscribe((status, err) => {
        const errMsg = err
          ? (err instanceof Error ? err.message : String(err))
          : '';

        logger.debug('Realtime subscription status', 'useCalls', { status, error: errMsg || undefined });

        channelHealthy = status === 'SUBSCRIBED';
        if (status === 'SUBSCRIBED') {
          // Do an immediate check once subscription is ready
          void checkForRingingCall();
        }

        // If bindings mismatch, disable Realtime for this hook and rely on polling.
        if (status === 'CHANNEL_ERROR' && errMsg.includes('mismatch between server and client bindings')) {
          logger.warn('Realtime bindings mismatch; falling back to polling-only.', 'useCalls');
          if (!channelRemoved) {
            channelRemoved = true;
            supabase.removeChannel(channel);
          }
        }
      });

    return () => {
      navigator.serviceWorker?.removeEventListener('message', onPushClick);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
      }
      if (!channelRemoved) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  // The app-wide call listener only needs signaling; history is opened on demand.
  useEffect(() => {
    if (loadHistory) void fetchCallHistory();
    else setLoading(false);
  }, [loadHistory, fetchCallHistory]);

  return {
    incomingCall,
    setIncomingCall,
    callHistory,
    scheduledCalls,
    scheduledError: scheduling.error,
    scheduledLoading: scheduling.isLoading,
    loading,
    updateRsvp,
    cancelScheduledCall,
    getCallStatistics,
    fetchCallHistory,
    fetchScheduledCalls,
  };
}
