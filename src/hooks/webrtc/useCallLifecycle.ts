import { notifyIncomingCall } from '@/lib/call-push';
/**
 * useCallLifecycle - Manages call lifecycle (initiate, answer, decline, end)
 * Coordinates between media, peer connections, and signaling
 */
import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../useAuth';
import { getWebRTCConfig } from './types';
import { logger } from '@/lib/logger';

export interface UseCallLifecycleOptions {
  onCallStarted: (callId: string) => void;
  onCallEnded: () => void;
  onCallFailed: (error: string) => void;
  onRingTimeout: (callId: string) => void;
}

export interface UseCallLifecycleReturn {
  /** Ring timeout ref for clearing */
  ringTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  /** Create call in database */
  createCallInDB: (targetUserId: string, callType: 'voice' | 'video', conversationId?: string, transport?: 'webrtc' | 'livekit') => Promise<string>;
  /** Update participant status */
  updateParticipantStatus: (callId: string, userId: string, status: string, joinedAt?: boolean) => Promise<void>;
  /** Update call status */
  updateCallStatus: (callId: string, status: string, startedAt?: boolean, endedAt?: boolean, endReason?: string) => Promise<void>;
  /** Set ring timeout for unanswered calls */
  setRingTimeout: (callId: string) => void;
  /** Clear ring timeout */
  clearRingTimeout: () => void;
  /** End call in database */
  endCallInDB: (callId: string, userId: string) => Promise<void>;
  /** Decline call in database */
  declineCallInDB: (callId: string, userId: string) => Promise<void>;
  /** Calculate call duration */
  getCallDuration: (callId: string) => Promise<number | null>;
  /** Raise hand in call */
  raiseHand: (callId: string, userId: string, raised: boolean) => Promise<void>;
  /** Send reaction in call */
  sendReaction: (callId: string, userId: string, emoji: string) => Promise<void>;
  /** Update mute/video status */
  updateMediaStatus: (callId: string, userId: string, isMuted?: boolean, isVideoEnabled?: boolean, isScreenSharing?: boolean) => Promise<void>;
}

export function useCallLifecycle(options: UseCallLifecycleOptions): UseCallLifecycleReturn {
  const { user } = useAuth();
  const { onCallEnded, onRingTimeout } = options;
  
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const config = getWebRTCConfig();

  /**
   * Create a new call in the database via RPC
   */
  const createCallInDB = useCallback(async (
    targetUserId: string,
    callType: 'voice' | 'video',
    conversationId?: string,
    transport: 'webrtc' | 'livekit' = 'webrtc'
  ): Promise<string> => {
    logger.debug('Creating call in database...', 'CallLifecycle');

    const { data: callId, error } = await supabase.rpc('create_call', {
      p_callee_id: targetUserId,
      p_call_type: callType,
      p_conversation_id: conversationId ?? null,
    });

    if (error) {
      logger.error('Error creating call', 'CallLifecycle', error);
      throw error;
    }

    if (!callId) {
      throw new Error('Failed to create call');
    }

    logger.debug('Call created', 'CallLifecycle', callId);
    if (transport === 'livekit') {
      // Persist before inviting: updated clients can distinguish existing WebRTC
      // calls from LiveKit calls without changing the call schema.
      const { data: marked, error: markError } = await supabase.from('calls')
        .update({ sdp_offer: { transport: 'livekit-v1' } }).eq('id', callId).select('id').maybeSingle();
      if (markError || !marked) {
        await supabase.from('calls').update({ status: 'failed', ended_at: new Date().toISOString() }).eq('id', callId);
        throw markError || new Error('Não foi possível preparar a chamada.');
      }
    }
    void notifyIncomingCall(callId);
    return callId;
  }, []);

  /**
   * Update participant status in database
   */
  const updateParticipantStatus = useCallback(async (
    callId: string,
    userId: string,
    status: string,
    joinedAt = false
  ) => {
    const update: Record<string, unknown> = { status };
    if (joinedAt) {
      update.joined_at = new Date().toISOString();
    }
    if (status === 'left' || status === 'declined') {
      update.left_at = new Date().toISOString();
    }

    await supabase
      .from('call_participants')
      .update(update)
      .eq('call_id', callId)
      .eq('user_id', userId);
  }, []);

  /**
   * Update call status in database
   */
  const updateCallStatus = useCallback(async (
    callId: string,
    status: string,
    startedAt = false,
    endedAt = false,
    endReason?: string
  ) => {
    const update: Record<string, unknown> = { status };
    if (startedAt) {
      update.started_at = new Date().toISOString();
    }
    if (endedAt) {
      update.ended_at = new Date().toISOString();
    }
    if (endReason) {
      update.end_reason = endReason;
    }

    await supabase
      .from('calls')
      .update(update)
      .eq('id', callId);
  }, []);

  /**
   * Set ring timeout - call will end if not answered within timeout
   */
  const setRingTimeout = useCallback((callId: string) => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
    }

    logger.debug('Setting ring timeout (ms)', 'CallLifecycle', config.ringTimeoutMs);

    ringTimeoutRef.current = setTimeout(async () => {
      logger.debug('⏰ Ring timeout - no answer received', 'CallLifecycle');
      
      await supabase
        .from('calls')
        .update({ status: 'ended', ended_at: new Date().toISOString(), end_reason: 'no_answer' })
        .eq('id', callId);
      
      await supabase
        .from('call_participants')
        .update({ status: 'declined', left_at: new Date().toISOString() })
        .eq('call_id', callId)
        .eq('status', 'ringing');
      
      onRingTimeout(callId);
      onCallEnded();
    }, config.ringTimeoutMs);
  }, [config.ringTimeoutMs, onRingTimeout, onCallEnded]);

  /**
   * Clear ring timeout
   */
  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
      logger.debug('Cleared ring timeout', 'CallLifecycle');
    }
  }, []);

  /**
   * End call in database with duration calculation
   */
  const endCallInDB = useCallback(async (callId: string, userId: string) => {
    logger.debug('Ending call in database', 'CallLifecycle', callId);

    // Calculate duration
    const { data: call } = await supabase
      .from('calls')
      .select('started_at')
      .eq('id', callId)
      .single();

    let durationSeconds = null;
    if (call?.started_at) {
      durationSeconds = Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000);
    }

    // Update call
    const { data: ended, error: endError } = await supabase
      .from('calls')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        end_reason: 'completed',
      })
      .eq('id', callId).select('id').maybeSingle();
    if (endError || !ended) throw endError || new Error('Call end was not confirmed');

    // Update participant
    const { error: participantError } = await supabase
      .from('call_participants')
      .update({ status: 'left', left_at: new Date().toISOString() })
      .eq('call_id', callId)
      .eq('user_id', userId);
    if (participantError) throw participantError;
  }, []);

  /**
   * Decline call in database
   */
  const declineCallInDB = useCallback(async (callId: string, userId: string) => {
    logger.debug('Declining call in database', 'CallLifecycle', callId);

    await supabase
      .from('call_participants')
      .update({ status: 'declined' })
      .eq('call_id', callId)
      .eq('user_id', userId);

    await supabase
      .from('calls')
      .update({ status: 'declined', ended_at: new Date().toISOString(), end_reason: 'declined' })
      .eq('id', callId);
  }, []);

  /**
   * Get call duration in seconds
   */
  const getCallDuration = useCallback(async (callId: string): Promise<number | null> => {
    const { data: call } = await supabase
      .from('calls')
      .select('started_at')
      .eq('id', callId)
      .single();

    if (call?.started_at) {
      return Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000);
    }
    return null;
  }, []);

  /**
   * Raise hand in call
   */
  const raiseHand = useCallback(async (callId: string, userId: string, raised: boolean) => {
    await supabase
      .from('call_participants')
      .update({ is_hand_raised: raised })
      .eq('call_id', callId)
      .eq('user_id', userId);
  }, []);

  /**
   * Send reaction in call
   */
  const sendReaction = useCallback(async (callId: string, userId: string, emoji: string) => {
    await supabase.from('call_reactions').insert({
      call_id: callId,
      user_id: userId,
      emoji,
    });
  }, []);

  /**
   * Update media status (mute/video/screen share)
   */
  const updateMediaStatus = useCallback(async (
    callId: string,
    userId: string,
    isMuted?: boolean,
    isVideoEnabled?: boolean,
    isScreenSharing?: boolean
  ) => {
    const update: Record<string, boolean> = {};
    if (isMuted !== undefined) update.is_muted = isMuted;
    if (isVideoEnabled !== undefined) update.is_video_enabled = isVideoEnabled;
    if (isScreenSharing !== undefined) update.is_screen_sharing = isScreenSharing;

    if (Object.keys(update).length > 0) {
      await supabase
        .from('call_participants')
        .update(update)
        .eq('call_id', callId)
        .eq('user_id', userId);
    }
  }, []);

  return {
    ringTimeoutRef,
    createCallInDB,
    updateParticipantStatus,
    updateCallStatus,
    setRingTimeout,
    clearRingTimeout,
    endCallInDB,
    declineCallInDB,
    getCallDuration,
    raiseHand,
    sendReaction,
    updateMediaStatus,
  };
}
