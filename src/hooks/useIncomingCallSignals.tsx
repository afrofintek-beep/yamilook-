/* @refresh reset */
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

interface IncomingOffer {
  callId: string;
  callType: 'voice' | 'video';
  callerId: string;
  sdp: RTCSessionDescriptionInit;
}

interface UseIncomingCallSignalsProps {
  onOfferReceived: (offer: IncomingOffer) => void;
}

/**
 * This hook listens for incoming WebRTC offer signals sent to the current user.
 * It subscribes to call_signals by to_user_id ONLY (not by call_id),
 * so the callee can detect offers before knowing the call_id.
 */
export function useIncomingCallSignals({ onOfferReceived }: UseIncomingCallSignalsProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const processedOffers = useRef<Set<string>>(new Set());
  const onOfferReceivedRef = useRef(onOfferReceived);

  // Keep callback ref updated without triggering effect re-runs
  onOfferReceivedRef.current = onOfferReceived;

  useEffect(() => {
    if (!userId) {
      return;
    }

    let disposed = false;
    const channelName = `incoming-offers-${userId}-${crypto.randomUUID()}`;
    // Subscribe silently in production

    // Subscribe to all call_signals sent TO this user
    // Using broader subscription to avoid server/client binding mismatch errors
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
        },
        (payload) => {
          if (disposed) return;
          const signal = payload.new as Tables<'call_signals'>;
          
          // Client-side filter: only process signals for this user
          if (signal.to_user_id !== userId) return;
          
          logger.debug('📨 Signal received', 'IncomingCallSignals', signal);

          // Only process offer signals
          if (signal.signal_type !== 'offer') {
            logger.debug('⏭️ Ignoring non-offer signal type', 'IncomingCallSignals', signal.signal_type);
            return;
          }

          // Prevent duplicate processing
          if (processedOffers.current.has(signal.id)) {
            logger.debug('⚠️ Already processed this offer, skipping', 'IncomingCallSignals', signal.id);
            return;
          }
          processedOffers.current.add(signal.id);

          // Extract call type from payload or default to voice
          const sdpPayload = signal.payload as unknown as RTCSessionDescriptionInit | null;

          // Determine call type from SDP content (video calls have video in SDP)
          let callType: 'voice' | 'video' = 'voice';
          if (sdpPayload?.sdp && sdpPayload.sdp.includes('m=video')) {
            callType = 'video';
          }

          if (sdpPayload) {
            logger.debug('🔔 Processing offer, triggering onOfferReceived', 'IncomingCallSignals', { callId: signal.call_id, callType, callerId: signal.from_user_id });
            onOfferReceivedRef.current({
              callId: signal.call_id,
              callType,
              callerId: signal.from_user_id,
              sdp: sdpPayload,
            });
          } else {
            logger.error('❌ Offer signal has NO SDP payload - cannot process!', 'IncomingCallSignals', signal);
          }
        }
      )
      .subscribe((status, err) => {
        if (disposed) return;
        logger.debug('📡 Subscription status', 'IncomingCallSignals', status);

        if (err) {
          logger.error('❌ Subscription error', 'IncomingCallSignals', err);
        }

        if (status === 'SUBSCRIBED') {
          logger.debug('✅ Successfully subscribed, checking for missed pending offers', 'IncomingCallSignals');
          void checkPendingOffers(userId);
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('❌ Channel error - subscription failed', 'IncomingCallSignals');
        } else if (status === 'TIMED_OUT') {
          logger.error('⏰ Subscription timed out', 'IncomingCallSignals');
        } else if (status === 'CLOSED') {
          logger.debug('🔒 Channel closed', 'IncomingCallSignals');
        }
      });

    // Check for pending offers on initial subscribe
    // Only fetch offers from the last 2 minutes to avoid processing stale calls
    const checkPendingOffers = async (userId: string) => {
      logger.debug('🔍 Checking for recent pending offers', 'IncomingCallSignals');

      try {
        // Only look for offers created in the last 2 minutes
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        const { data: pendingSignals, error } = await supabase
          .from('call_signals')
          .select('*')
          .eq('to_user_id', userId)
          .eq('signal_type', 'offer')
          .eq('processed', false)
          .gte('created_at', twoMinutesAgo)
          .order('created_at', { ascending: true });

        if (disposed) return;
        if (error) {
          logger.error('❌ Error fetching pending offers', 'IncomingCallSignals', error);
          return;
        }

        logger.debug('📊 Recent pending offers', 'IncomingCallSignals', pendingSignals?.length || 0);

        if (pendingSignals && pendingSignals.length > 0) {
          // Process only the most recent offer per call
          const latestOfferByCall = new Map<string, typeof pendingSignals[0]>();
          for (const signal of pendingSignals) {
            latestOfferByCall.set(signal.call_id, signal);
          }

          for (const signal of latestOfferByCall.values()) {
            if (processedOffers.current.has(signal.id)) continue;
            processedOffers.current.add(signal.id);

            const sdpPayload = signal.payload as unknown as RTCSessionDescriptionInit | null;
            let callType: 'voice' | 'video' = 'voice';
            if (sdpPayload?.sdp && sdpPayload.sdp.includes('m=video')) {
              callType = 'video';
            }

            if (sdpPayload) {
              logger.debug('🔔 Processing recent offer for call', 'IncomingCallSignals', signal.call_id);
              onOfferReceivedRef.current({
                callId: signal.call_id,
                callType,
                callerId: signal.from_user_id,
                sdp: sdpPayload,
              });
            }
          }
        } else {
          logger.debug('✅ No recent pending offers', 'IncomingCallSignals');
        }
      } catch (err) {
        logger.error('❌ Error checking pending offers', 'IncomingCallSignals', err);
      }
    };

    return () => {
      disposed = true;
      logger.debug('🔌 Unsubscribing from Realtime channel', 'IncomingCallSignals', channelName);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Cleanup old processed offers periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      // Keep only the last 100 processed offers
      if (processedOffers.current.size > 100) {
        const arr = Array.from(processedOffers.current);
        processedOffers.current = new Set(arr.slice(-50));
      }
    }, 60000);

    return () => clearInterval(cleanup);
  }, []);
}
