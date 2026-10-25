/* @refresh reset */
/**
 * useWebRTC - Main orchestrator hook for WebRTC calling
 *
 * FIXES (production stability):
 * A) ICE servers passed via getter — never stale
 * B) ICE candidates always queued until remoteDescription, then flushed
 * C) Stale closures eliminated — remoteStreams read from ref, useEffect-driven playback
 * D) Single signaling consumer (useWebRTCSignaling) — no duplicate signal processing
 * E) Recovery ladder wired from usePeerConnection
 * F) iOS Safari gesture-unlock for autoplay
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { useWebRTCSignaling, EventPayload } from './useWebRTCSignaling';
import { useICEServers } from './useICEServers';

import { finishCallLocallyFirst, watchCallTermination } from './webrtc/call-termination';
import { useMediaCapture } from './webrtc/useMediaCapture';
import { usePeerConnection } from './webrtc/usePeerConnection';
import { useICECandidateQueue } from './webrtc/useICECandidateQueue';
import { useCallLifecycle } from './webrtc/useCallLifecycle';
import { useAutoplayRecovery } from './webrtc/useAutoplayRecovery';
import { useCallTelemetry } from './webrtc/useCallTelemetry';
import { CallState, CallSettings, INITIAL_STATE, CallMetrics } from './webrtc/types';
import { VirtualBackgroundProcessor, effectsActive, DEFAULT_EFFECTS, type BgMode, type EffectsConfig } from '@/lib/virtualBackground';

export type { PeerConnection, CallState, CallSettings, CallMetrics } from './webrtc/types';

export interface UseWebRTCOptions {
  onCallMetrics?: (metrics: CallMetrics) => void;
}

export function useWebRTC(options: UseWebRTCOptions = {}) {
  const { onCallMetrics } = options;
  const { user } = useAuth();
  const { getServersForCall, iceServers: cachedIceServers } = useICEServers();
  const [state, setState] = useState<CallState>(INITIAL_STATE);

  // ─── Refs for immediate access in callbacks (no stale closures) ───
  const callIdRef = useRef<string | null>(null);
  const callConnectingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  // Stable ref so the cleanup effect only fires on actual unmount, not when cleanupCall's
  // deps change (e.g. when state.callId changes → telemetry changes → cleanupCall changes).
  // Without this, every time B answers a call the PC gets destroyed immediately after creation.
  const cleanupCallRef = useRef<() => void>(() => {});
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const vbgProcessorRef = useRef<VirtualBackgroundProcessor | null>(null);
  const effectsConfigRef = useRef<EffectsConfig>({ ...DEFAULT_EFFECTS });

  useEffect(() => { callIdRef.current = state.callId; }, [state.callId]);
  // Keep iceServersRef warm with cached servers so getter always has something
  useEffect(() => { if (cachedIceServers.length > 0) iceServersRef.current = cachedIceServers; }, [cachedIceServers]);

  // Gate: wait for TURN credentials with retry + STUN fallback
  const ensureIceServersReady = useCallback(async () => {
    const timeoutMs = 3000;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const s = await getServersForCall();
      if (s && s.length > 0) {
        iceServersRef.current = s;
        return;
      }
      await new Promise(r => setTimeout(r, 250));
    }

    // fallback STUN only (last resort)
    console.warn('[WebRTC] ⚠️ ICE servers timeout — falling back to STUN only');
    iceServersRef.current = [{ urls: 'stun:stun.l.google.com:19302' }];
  }, [getServersForCall]);

  // ─── Focused hooks ───
  const mediaCapture = useMediaCapture();
  const iceQueue = useICECandidateQueue();
  const autoplay = useAutoplayRecovery();

  const lifecycle = useCallLifecycle({
    onCallStarted: (callId) => console.log('[WebRTC] Call started:', callId),
    onCallEnded: () => { cleanupCall(); setState(prev => ({ ...prev, callStatus: 'ended' })); },
    onCallFailed: (error) => { cleanupCall(); setState(prev => ({ ...prev, callStatus: 'failed', lastError: error })); },
    onRingTimeout: () => { cleanupCallRef.current(); setState(prev => ({ ...prev, callStatus: 'ended', lastError: 'No answer' })); },
  });

  // ─── Remote stream handler (writes to ref + state) ───
  const handleRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    if (!callIdRef.current) return;
    const existing = remoteStreamsRef.current.get(peerId);
    if (existing && existing.id === stream.id) return;

    remoteStreamsRef.current.set(peerId, stream);
    setState(prev => {
      const newStreams = new Map(prev.remoteStreams);
      newStreams.set(peerId, stream);
      return { ...prev, remoteStreams: newStreams };
    });
  }, []);

  // useEffect-driven playback: whenever remoteStreams state changes, try to play
  useEffect(() => {
    state.remoteStreams.forEach((stream, peerId) => {
      autoplay.tryPlayRemoteStream(stream, peerId);
    });
  }, [state.remoteStreams, autoplay]);

  // ─── Connection state handlers ───
  const handleConnectionStateChange = useCallback((connectionState: RTCPeerConnectionState) => {
    if (!callIdRef.current) return;
    setState(prev => ({ ...prev, connectionState }));
    if (connectionState === 'connected') {
      lifecycle.clearRingTimeout();
      // Clear connecting/offer-wait timeout — connection established successfully
      if (callConnectingTimeoutRef.current) {
        clearTimeout(callConnectingTimeoutRef.current);
        callConnectingTimeoutRef.current = null;
      }
      setState(prev => ({ ...prev, callStatus: 'connected' }));
    } else if (connectionState === 'connecting') {
      // WebRTC handshake started — clear the "no offer received" timeout
      // since we clearly got the offer and are now negotiating
      if (callConnectingTimeoutRef.current) {
        clearTimeout(callConnectingTimeoutRef.current);
        callConnectingTimeoutRef.current = null;
      }
    } else if (connectionState === 'failed') {
      // Recovery ladder in usePeerConnection handles retries; we only update UI status
      // after all recovery attempts are exhausted (it will fire 'failed' again)
      setState(prev => ({ ...prev, callStatus: 'failed' }));
    }
  }, [lifecycle]);

  const handleIceStateChange = useCallback((iceState: RTCIceConnectionState) => {
    if (iceState === 'connected' || iceState === 'completed') lifecycle.clearRingTimeout();
  }, [lifecycle]);

  // ─── Send signal via DB (used outside of signaling hook for outgoing ICE etc.) ───
  const sendSignalForCall = useCallback(
    async (
      callId: string,
      toUserId: string,
      signalType: 'offer' | 'answer' | 'ice-candidate' | 'call-accepted' | 'call-ended' | 'call-declined',
      payload?: unknown
    ) => {
      if (!user) return false;
      const { error } = await supabase.from('call_signals').insert({
        call_id: callId,
        from_user_id: user.id,
        to_user_id: toUserId,
        signal_type: signalType,
        payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
      });
      if (error) { console.error('[WebRTC] Signal send error:', error); return false; }
      return true;
    },
    [user]
  );

  // ─── ICE candidate handler (outgoing) ───
  const handleIceCandidate = useCallback((peerId: string, candidate: RTCIceCandidateInit) => {
    const callId = callIdRef.current;
    if (!callId) {
      iceQueue.queueOutgoingCandidate(peerId, candidate);
      return;
    }
    sendSignalForCall(callId, peerId, 'ice-candidate', candidate);
  }, [iceQueue, sendSignalForCall]);

  // ─── Negotiation needed handler ───
  const handleNegotiationNeeded = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const callId = callIdRef.current;
    if (!callId) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignalForCall(callId, peerId, 'offer', offer);
    } catch (error) {
      console.error('[WebRTC] Renegotiation failed:', error);
    }
  }, [sendSignalForCall]);

  // ─── Recovery renegotiation handler (called by recovery ladder step 2) ───
  const handleRecoveryRenegotiate = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const callId = callIdRef.current;
    if (!callId) return;
    try {
      console.log('[WebRTC] 🔄 Recovery renegotiation for:', peerId);
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      await sendSignalForCall(callId, peerId, 'offer', offer);
    } catch (error) {
      console.error('[WebRTC] Recovery renegotiation failed:', error);
    }
  }, [sendSignalForCall]);

  // ─── Peer connection hook (getter-based, no stale closures) ───
  const peerConnection = usePeerConnection({
    getIceServers: () => iceServersRef.current,
    getLocalStream: () => mediaCapture.localStreamRef.current,
    callIdRef,
    onIceCandidate: handleIceCandidate,
    onRemoteStream: handleRemoteStream,
    onConnectionStateChange: handleConnectionStateChange,
    onIceStateChange: handleIceStateChange,
    onNegotiationNeeded: handleNegotiationNeeded,
    onRecoveryRenegotiate: handleRecoveryRenegotiate,
  });

  // ─── Telemetry ───
  const telemetry = useCallTelemetry({
    callId: state.callId,
    peerConnections: peerConnection.peerConnections,
    onCallMetrics,
    enabled: true,
  });

  // ─── Cleanup ───
  const cleanupCall = useCallback(() => {
    callIdRef.current = null;
    lifecycle.clearRingTimeout();
    if (callConnectingTimeoutRef.current) {
      clearTimeout(callConnectingTimeoutRef.current);
      callConnectingTimeoutRef.current = null;
    }
    if (vbgProcessorRef.current) { vbgProcessorRef.current.stop(); vbgProcessorRef.current = null; }
    peerConnection.closeAllPeerConnections();
    iceQueue.clearAllQueues();
    mediaCapture.stopAllMedia();
    telemetry.logFinalMetrics();
    remoteStreamsRef.current.clear();
    setState(prev => ({ ...INITIAL_STATE, callStatus: 'ended', lastError: prev.lastError }));
  }, [lifecycle, peerConnection, iceQueue, mediaCapture, telemetry]);

  useEffect(() => {
    if (!state.callId) return;
    const id = state.callId;
    return watchCallTermination({
      read: async () => {
        const { data, error } = await supabase.from('calls').select('status').eq('id', id).maybeSingle();
        if (error) throw error;
        return data?.status || null;
      },
      subscribe: listener => {
        const channel = supabase.channel(`call-termination-${id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${id}` }, payload => listener(String(payload.new.status)))
          .subscribe();
        return () => { void supabase.removeChannel(channel); };
      },
      onEnded: () => { if (callIdRef.current === id) cleanupCallRef.current(); },
    });
  }, [state.callId]);

  // ─── Apply pending ICE candidates ───
  const applyPendingCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    await iceQueue.applyPendingCandidates(peerId, pc);
  }, [iceQueue]);

  // ─── Handle incoming offer ───
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, from: string) => {
    console.log('[WebRTC] Received OFFER from:', from);

    // Cancel the "no offer received" timeout — we got the offer
    if (callConnectingTimeoutRef.current) {
      clearTimeout(callConnectingTimeoutRef.current);
      callConnectingTimeoutRef.current = null;
    }

    const pc = peerConnection.getPeerConnection(from);
    if (!pc) { console.error('[WebRTC] No PC for offer from:', from); return; }

    try {
      if (pc.signalingState !== 'stable') {
        console.log('[WebRTC] Glare detected, rolling back');
        await pc.setLocalDescription({ type: 'rollback' });
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // CRITICAL: flush queued ICE candidates immediately after setRemoteDescription
      await applyPendingCandidates(from, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      // CRITICAL: Use pc.localDescription (finalized SDP) to avoid
      // serialization issues on some mobile browsers
      const finalAnswer = pc.localDescription;
      if (!finalAnswer) {
        console.error('[WebRTC] Failed to create local description for answer');
        return;
      }
      return { type: finalAnswer.type, sdp: finalAnswer.sdp } as RTCSessionDescriptionInit;
    } catch (error) {
      console.error('[WebRTC] Error handling offer:', error);
    }
  }, [peerConnection, applyPendingCandidates]);

  // ─── Handle incoming answer ───
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit, from: string) => {
    const pc = peerConnection.getPeerConnection(from);
    if (!pc) return;
    if (pc.signalingState !== 'have-local-offer') {
      console.warn('[WebRTC] Unexpected answer in state:', pc.signalingState);
      return;
    }
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      // CRITICAL: flush queued ICE candidates immediately after setRemoteDescription
      await applyPendingCandidates(from, pc);
      // Do NOT force 'connecting' here — the RTCPeerConnection.onconnectionstatechange
      // handler already drives status transitions accurately (connected/connecting/failed).
      // Forcing 'connecting' here overwrites an already-connected state on fast networks
      // and causes the initiator (desktop A) to be stuck showing "connecting" even after
      // ICE completes, because handleConnectionStateChange fires before this setState.
      console.log('[WebRTC] ✅ Answer processed, ICE handshake in progress');
    } catch (error) {
      console.error('[WebRTC] Error handling answer:', error);
    }
  }, [peerConnection, applyPendingCandidates]);

  // ─── Handle incoming ICE candidate ───
  const handleIncomingIceCandidate = useCallback(async (candidate: RTCIceCandidateInit, from: string) => {
    const pc = peerConnection.getPeerConnection(from);

    // Queue if no PC or no remote description yet
    if (!pc || !pc.remoteDescription || pc.remoteDescription.type === null) {
      iceQueue.queueIncomingCandidate(from, candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
    }
  }, [peerConnection, iceQueue]);

  // ─── Handle signaling events ───
  const handleEvent = useCallback((event: EventPayload, from: string) => {
    if (!callIdRef.current) return;
    switch (event.type) {
      case 'ended':
        telemetry.setCallEndReason('remote_hangup');
        cleanupCall();
        setState(prev => ({ ...prev, callStatus: 'ended' }));
        break;
      case 'declined':
        telemetry.setCallEndReason('declined');
        cleanupCall();
        setState(prev => ({ ...prev, callStatus: 'declined' }));
        break;
      case 'accepted':
        lifecycle.clearRingTimeout();
        // Only move to 'connecting' if we haven't already reached 'connected'
        // (fast networks can complete ICE before the 'accepted' signal is processed)
        setState(prev => prev.callStatus === 'connected' ? prev : { ...prev, callStatus: 'connecting' });
        break;
      case 'connected':
        lifecycle.clearRingTimeout();
        setState(prev => ({ ...prev, callStatus: 'connected' }));
        break;
    }
  }, [cleanupCall, lifecycle, telemetry]);

  // ─── Flush outgoing ICE candidates (declared before signaling to avoid stale closure) ───
  const flushOutgoingIceCandidates = useCallback(async (peerId: string) => {
    const callId = callIdRef.current;
    if (!callId) return;
    const queued = iceQueue.flushOutgoingCandidates(peerId);
    for (const candidate of queued) {
      await sendSignalForCall(callId, peerId, 'ice-candidate', candidate);
    }
  }, [iceQueue, sendSignalForCall]);

  // Keep a stable ref so the signaling onOffer callback always uses the latest version
  const flushOutgoingIceCandidatesRef = useRef(flushOutgoingIceCandidates);
  useEffect(() => { flushOutgoingIceCandidatesRef.current = flushOutgoingIceCandidates; }, [flushOutgoingIceCandidates]);

  // Keep a stable ref to sendAnswer so the onOffer callback below doesn't go stale
  const signalingRef = useRef<ReturnType<typeof useWebRTCSignaling> | null>(null);

  // ─── Initialize signaling (SINGLE consumer for call_signals) ───
  const signaling = useWebRTCSignaling({
    callId: state.callId,
    onOffer: async (offer, from) => {
      const answer = await handleOffer(offer, from);
      if (answer && signalingRef.current) {
        signalingRef.current.sendAnswer(from, answer);
        // Flush any ICE candidates queued before callId / remoteDescription were ready
        await flushOutgoingIceCandidatesRef.current(from);
      }
    },
    onAnswer: handleAnswer,
    onIceCandidate: handleIncomingIceCandidate,
    onEvent: handleEvent,
  });

  // Keep ref in sync
  useEffect(() => { signalingRef.current = signaling; }, [signaling]);


  // ─── Initiate a call ───
  const initiateCall = useCallback(async (
    targetUserId: string,
    callType: 'voice' | 'video',
    conversationId?: string
  ): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    // Track whether the call was created in DB so we can clean it up on failure
    let createdCallId: string | null = null;

    try {
      // NOTE: We do NOT call setState here yet to avoid triggering React re-renders
      // that could flush cleanup effects (closeAllPeerConnections / stopAllMedia)
      // between getUserMedia and createPeerConnection. All state is updated in a
      // single batch AFTER the peer connection and offer are fully created.

      // 1. Ensure ICE/TURN servers ready (with timeout gate + STUN fallback)
      await ensureIceServersReady();

      // 2. Get user media — with automatic audio-only fallback if video fails
      const capturedStream = await mediaCapture.getUserMedia({
        videoEnabled: callType === 'video',
        audioEnabled: true,
        noiseSuppression: true,
        echoCancellation: true,
      });
      if (!capturedStream) throw new Error('Falha ao aceder ao microfone');

      // Diagnose audio track state for the initiator (desktop A)
      const initiatorAudioTracks = capturedStream.getAudioTracks();
      if (initiatorAudioTracks.length === 0) {
        console.warn('[WebRTC] ⚠️ Initiator has NO audio tracks — microphone may be blocked or unavailable');
      } else {
        initiatorAudioTracks.forEach(t => {
          console.log(`[WebRTC] 🎤 Initiator audio track: enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState} label="${t.label}"`);
          if (t.muted) {
            console.warn('[WebRTC] ⚠️ Initiator audio track is hardware-muted. Check browser microphone permissions for this site (chrome://settings/content/microphone).');
          }
          if (!t.enabled) {
            console.warn('[WebRTC] ⚠️ Initiator audio track is software-disabled. Enabling it now...');
            t.enabled = true;
          }
        });
      }

      // 3. Create call in DB
      const callId = await lifecycle.createCallInDB(targetUserId, callType, conversationId);
      createdCallId = callId;
      callIdRef.current = callId;
      lifecycle.setRingTimeout(callId);

      // 4. Create peer connection (reads iceServersRef via getter).
      // CRITICAL: Do this BEFORE any setState to prevent React re-renders from
      // triggering cleanup effects that stop media and close peer connections.
      const pc = peerConnection.createPeerConnection(targetUserId);

      // 5. Create and send offer
      // CRITICAL: Do NOT use legacy offerToReceiveAudio/Video options when tracks
      // are already added via addTrack(). Those options can create extra recvonly
      // transceivers that override the sendrecv transceivers created by addTrack(),
      // causing the initiator's audio to not be transmitted to the remote peer.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // CRITICAL: Use pc.localDescription (finalized SDP) instead of the
      // original offer object, which may be invalidated after setLocalDescription
      // on some mobile browsers (returns {} when serialized).
      const finalOffer = pc.localDescription;
      if (!finalOffer) {
        throw new Error('Falha ao criar descrição local WebRTC');
      }

      const offerPayload = { type: finalOffer.type, sdp: finalOffer.sdp };
      console.log('[WebRTC] Sending offer, SDP length:', offerPayload.sdp?.length ?? 0);

      let offerSent = await sendSignalForCall(callId, targetUserId, 'offer', offerPayload);
      if (!offerSent) {
        console.warn('[WebRTC] ⚠️ Offer send failed, retrying...');
        await new Promise(r => setTimeout(r, 500));
        offerSent = await sendSignalForCall(callId, targetUserId, 'offer', offerPayload);
        if (!offerSent) {
          throw new Error('Falha ao enviar sinal de chamada');
        }
      }
      console.log('[WebRTC] ✅ Offer sent successfully');

      // 6. Flush queued ICE candidates
      await flushOutgoingIceCandidates(targetUserId);

      // 7. NOW update state in a single batch — peer connection and offer are fully ready.
      // Doing this here (instead of before createPeerConnection) prevents React
      // from re-rendering mid-flow and triggering cleanup effects that would
      // destroy the local stream and peer connections before the offer is sent.
      setState(prev => ({
        ...prev,
        callId,
        callStatus: 'ringing',
        isInitiator: true,
        targetUserId,
        callType,
        lastError: null,
        localStream: mediaCapture.localStreamRef.current,
      }));

      // 8. Connecting timeout for initiator — if no connection within 30s, fail
      const connectingTimeout = setTimeout(() => {
        setState(prev => {
          if (prev.callStatus === 'ringing' || prev.callStatus === 'connecting') {
            console.error('[WebRTC] ❌ Initiator connecting timeout');
            cleanupCall();
            return { ...prev, callStatus: 'failed', lastError: 'Sem resposta' };
          }
          return prev;
        });
      }, 30_000);
      callConnectingTimeoutRef.current = connectingTimeout;

      return callId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[WebRTC] Error initiating call:', error);

      // CRITICAL: If we created a call in DB but failed before sending the offer,
      // mark it as failed so the callee doesn't get stuck waiting for an offer that never comes.
      if (createdCallId) {
        console.warn('[WebRTC] Marking call as failed in DB:', createdCallId);
        supabase.from('calls').update({
          status: 'failed',
          ended_at: new Date().toISOString(),
          end_reason: 'initiator_error',
        }).eq('id', createdCallId).then();

        supabase.from('call_participants').update({
          status: 'left',
          left_at: new Date().toISOString(),
        }).eq('call_id', createdCallId).then();
      }

      cleanupCall();
      setState(prev => ({ ...prev, callStatus: 'failed', lastError: message }));
      throw error;
    }
  }, [user, ensureIceServersReady, mediaCapture, lifecycle, peerConnection, sendSignalForCall, flushOutgoingIceCandidates, cleanupCall]);

  // NOTE: Signal fetching for answer flow is now handled entirely by
  // useWebRTCSignaling (realtime subscription + polling with dedup).
  // This eliminates the duplicate-processing bug where both
  // fetchPendingSignalsForCall AND the signaling hook processed the same offer.

  // ─── Answer an incoming call ───
  const answerCall = useCallback(async (
    callId: string,
    callType: 'voice' | 'video',
    initiatorId: string
  ) => {
    if (!user) return;

    try {
      console.log('[WebRTC] ANSWERING CALL:', callId);

      // iOS Safari: mark user gesture for autoplay
      autoplay.markUserInteracted();
      callIdRef.current = callId;

      // 1. Ensure ICE/TURN servers ready (with timeout gate + STUN fallback)
      await ensureIceServersReady();

      // 2. Get user media
      const answererStream = await mediaCapture.getUserMedia({
        videoEnabled: callType === 'video',
        audioEnabled: true,
        noiseSuppression: true,
        echoCancellation: true,
      });
      if (!mediaCapture.localStreamRef.current) throw new Error('Failed to get local media stream');

      // Verify audio track is not hardware-muted (OS/browser permission block)
      const audioTracks = answererStream?.getAudioTracks() ?? [];
      if (audioTracks.length === 0) {
        console.warn('[WebRTC] ⚠️ Callee has NO audio tracks — microphone may be blocked or unavailable');
      } else {
        audioTracks.forEach(t => {
          console.log(`[WebRTC] 🎤 Callee audio track: enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`);
          if (t.muted) {
            console.warn('[WebRTC] ⚠️ Callee audio track is hardware-muted (OS/browser blocking mic access)');
          }
        });
      }

      // 3. Create peer connection (reads latest iceServers via getter)
      // NOTE: onnegotiationneeded is suppressed until remoteDescription is set
      // (see usePeerConnection.ts) so no spurious offer is created here.
      peerConnection.createPeerConnection(initiatorId);

      // 4. Update DB
      await lifecycle.updateParticipantStatus(callId, user.id, 'connected', true);
      await lifecycle.updateCallStatus(callId, 'ongoing', true);

      // 5. Notify caller
      await supabase.from('call_signals').insert({
        call_id: callId,
        from_user_id: user.id,
        to_user_id: initiatorId,
        signal_type: 'call-accepted',
        payload: JSON.parse(JSON.stringify({ type: 'accepted' })),
      });

      // 6. Set callId in state so the signaling subscription (useWebRTCSignaling)
      // starts on the next render. The signaling hook will:
      //   a) Subscribe to realtime INSERT events
      //   b) Immediately fetch all pending signals (offer + ICE) with dedup
      //   c) Poll every 1s as fallback until subscribed
      // This eliminates the previous duplicate-processing bug where
      // fetchPendingSignalsForCall + signaling both processed the same offer.
      setState(prev => ({
        ...prev,
        callId,
        callStatus: 'connecting',
        isInitiator: false,
        targetUserId: initiatorId,
        callType,
        localStream: mediaCapture.localStreamRef.current,
      }));

      console.log('[WebRTC] ✅ Call answered — signaling hook will process pending signals');

      // 7. Connecting timeout — if no WebRTC offer received within 15s, fail gracefully
      // This prevents B from being stuck at "Connecting..." if A failed to send the offer
      const connectingTimeout = setTimeout(async () => {
        setState(prev => {
          if (prev.callStatus === 'connecting' || prev.callStatus === 'ringing') {
            console.error('[WebRTC] ❌ Callee connecting timeout — no offer received from initiator');
            cleanupCall();
            return { ...prev, callStatus: 'failed', lastError: 'Sem resposta do outro utilizador' };
          }
          return prev;
        });
        // Mark call as failed in DB so initiator side also knows
        await supabase.from('calls').update({
          status: 'failed',
          ended_at: new Date().toISOString(),
          end_reason: 'no_offer_received',
        }).eq('id', callId).eq('status', 'ongoing');
      }, 15_000);

      callConnectingTimeoutRef.current = connectingTimeout;
    } catch (error) {
      console.error('[WebRTC] Error answering call:', error);
      cleanupCall();
      setState(prev => ({ ...prev, callStatus: 'failed' }));
      throw error;
    }
  }, [user, ensureIceServersReady, mediaCapture, peerConnection, lifecycle, autoplay, cleanupCall]);

  // ─── Decline ───
  const declineCall = useCallback(async (callId: string, initiatorId: string) => {
    if (!user) return;
    signaling.sendCallDeclined(initiatorId);
    await lifecycle.declineCallInDB(callId, user.id);
  }, [user, signaling, lifecycle]);

  // ─── End call ───
  const endCall = useCallback(async () => {
    const id = callIdRef.current || state.callId;
    const target = state.targetUserId;
    telemetry.setCallEndReason('local_hangup');
    const results = await finishCallLocallyFirst(
      () => { cleanupCall(); setState({ ...INITIAL_STATE, remoteStreams: new Map() }); },
      // Keep the terminal signal available for the other device's polling fallback.
      async () => { if (id && target && user) return signaling.sendCallEnded(target); },
      async () => { if (id && user) await lifecycle.endCallInDB(id, user.id); },
    );
    if (results.some(result => result.status === 'rejected' || result.value === false)) {
      toast({ title: 'Chamada terminada neste dispositivo', description: 'Não foi possível confirmar o encerramento no outro dispositivo. Verifica a ligação.', variant: 'destructive' });
    }
  }, [state.callId, state.targetUserId, user, signaling, lifecycle, cleanupCall, telemetry]);

  // ─── Media toggles with DB sync ───
  const toggleMute = useCallback(async () => {
    mediaCapture.toggleMute();
    if (state.callId && user) await lifecycle.updateMediaStatus(state.callId, user.id, !mediaCapture.isMuted, undefined, undefined);
    setState(prev => ({ ...prev, isMuted: !mediaCapture.isMuted }));
  }, [mediaCapture, state.callId, user, lifecycle]);

  const toggleVideo = useCallback(async () => {
    mediaCapture.toggleVideo();
    if (state.callId && user) await lifecycle.updateMediaStatus(state.callId, user.id, undefined, !mediaCapture.isVideoEnabled, undefined);
    setState(prev => ({ ...prev, isVideoEnabled: !mediaCapture.isVideoEnabled }));
  }, [mediaCapture, state.callId, user, lifecycle]);

  const toggleScreenShare = useCallback(async () => {
    const wasSharing = mediaCapture.isScreenSharing;
    try {
      await mediaCapture.toggleScreenShare();
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : 'Não foi possível partilhar o ecrã.';
      toast({ title: 'Partilha de ecrã', description: msg, variant: 'destructive' });
      return;
    }

    if (!wasSharing && mediaCapture.screenStreamRef.current) {
      // Started sharing: replace video track in PCs with screen track
      const videoTrack = mediaCapture.screenStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        peerConnection.peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });
      }
    } else if (wasSharing) {
      // Stopped sharing: restore camera track
      const cameraTrack = mediaCapture.localStreamRef.current?.getVideoTracks()[0];
      if (cameraTrack) {
        peerConnection.peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(cameraTrack);
        });
      }
    }

    if (state.callId && user) await lifecycle.updateMediaStatus(state.callId, user.id, undefined, undefined, mediaCapture.isScreenSharing);
    setState(prev => ({ ...prev, isScreenSharing: mediaCapture.isScreenSharing, screenStream: mediaCapture.screenStreamRef.current }));
  }, [mediaCapture, peerConnection, state.callId, user, lifecycle]);

  const flipCamera = useCallback(async () => {
    await mediaCapture.flipCamera();
    const newTrack = mediaCapture.localStreamRef.current?.getVideoTracks()[0];
    if (newTrack) {
      peerConnection.peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(newTrack);
      });
    }
    setState(prev => ({ ...prev, localStream: mediaCapture.localStreamRef.current }));
  }, [mediaCapture, peerConnection]);

  // Virtual background: swap the outgoing video track for a segmentation-processed
  // one (blur / image / video bg). Mirrors the screen-share track swap. Fully
  // defensive — on any failure it restores the raw camera so a call never breaks.
  const replaceOutgoingVideo = useCallback((track: MediaStreamTrack) => {
    peerConnection.peerConnections.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(track).catch(() => {});
    });
  }, [peerConnection]);

  // Apply the current combined effects config (background + colour/beauty/face)
  // to the outgoing video via a single processor. If nothing is active, restore
  // the raw camera. Fully defensive — any failure reverts to the raw camera.
  const applyEffects = useCallback(async () => {
    const cfg = effectsConfigRef.current;
    const cameraTrack = mediaCapture.localStreamRef.current?.getVideoTracks()[0];
    const audioTrack = mediaCapture.localStreamRef.current?.getAudioTracks()[0];

    if (!effectsActive(cfg)) {
      if (vbgProcessorRef.current) { vbgProcessorRef.current.stop(); vbgProcessorRef.current = null; }
      if (cameraTrack) replaceOutgoingVideo(cameraTrack);
      setState(prev => ({ ...prev, localStream: mediaCapture.localStreamRef.current }));
      return;
    }
    if (!cameraTrack) return;

    try {
      if (!vbgProcessorRef.current) {
        vbgProcessorRef.current = await VirtualBackgroundProcessor.create(cameraTrack, cfg);
      } else {
        vbgProcessorRef.current.setEffects(cfg);
      }
      const processedTrack = vbgProcessorRef.current.outputStream.getVideoTracks()[0];
      if (!processedTrack) throw new Error('no processed track');
      replaceOutgoingVideo(processedTrack);
      const preview = new MediaStream();
      preview.addTrack(processedTrack);
      if (audioTrack) preview.addTrack(audioTrack);
      setState(prev => ({ ...prev, localStream: preview }));
    } catch (e) {
      console.error('[FX] effects failed, reverting to raw camera:', e);
      if (vbgProcessorRef.current) { vbgProcessorRef.current.stop(); vbgProcessorRef.current = null; }
      if (cameraTrack) replaceOutgoingVideo(cameraTrack);
      setState(prev => ({ ...prev, localStream: mediaCapture.localStreamRef.current }));
    }
  }, [mediaCapture, replaceOutgoingVideo]);

  const setVirtualBackground = useCallback(async (mode: BgMode) => {
    effectsConfigRef.current = { ...effectsConfigRef.current, background: mode };
    await applyEffects();
  }, [applyEffects]);

  const setCallEffects = useCallback(async (partial: Partial<EffectsConfig>) => {
    effectsConfigRef.current = { ...effectsConfigRef.current, ...partial };
    await applyEffects();
  }, [applyEffects]);

  // Audio processing toggles applied live to the mic track (real browser DSP).
  const setAudioProcessing = useCallback(async (
    opts: { noiseSuppression?: boolean; echoCancellation?: boolean; autoGainControl?: boolean },
  ) => {
    const audioTrack = mediaCapture.localStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;
    try { await audioTrack.applyConstraints(opts); }
    catch (e) { console.warn('[audio] applyConstraints failed:', e); }
  }, [mediaCapture]);

  const raiseHand = useCallback(async (raised: boolean) => {
    if (state.callId && user) await lifecycle.raiseHand(state.callId, user.id, raised);
  }, [state.callId, user, lifecycle]);

  const sendReaction = useCallback(async (emoji: string) => {
    if (state.callId && user) await lifecycle.sendReaction(state.callId, user.id, emoji);
  }, [state.callId, user, lifecycle]);

  // Legacy compat
  const setRemoteVideoRef = useCallback((_el: HTMLVideoElement | null) => {}, []);
  const playRemoteVideo = useCallback(async () => {
    state.remoteStreams.forEach((stream, peerId) => autoplay.tryPlayRemoteStream(stream, peerId));
  }, [state.remoteStreams, autoplay]);
  const getUserMedia = useCallback(async (settings: CallSettings) => {
    const stream = await mediaCapture.getUserMedia(settings);
    setState(prev => ({ ...prev, localStream: stream, isVideoEnabled: settings.videoEnabled, isMuted: !settings.audioEnabled }));
    return stream;
  }, [mediaCapture]);

  // Keep cleanupCallRef always pointing to the latest version
  useEffect(() => { cleanupCallRef.current = cleanupCall; }, [cleanupCall]);

  // Cleanup on unmount ONLY — empty deps ensures this cleanup never fires when
  // cleanupCall's identity changes mid-call (which would destroy the PC just created by answerCall).
   
  useEffect(() => { return () => { cleanupCallRef.current(); }; }, []);

  // Sync media state
  useEffect(() => {
    setState(prev => ({
      ...prev,
      localStream: mediaCapture.localStream,
      isMuted: mediaCapture.isMuted,
      isVideoEnabled: mediaCapture.isVideoEnabled,
      isScreenSharing: mediaCapture.isScreenSharing,
      screenStream: mediaCapture.screenStream,
    }));
  }, [mediaCapture.localStream, mediaCapture.isMuted, mediaCapture.isVideoEnabled, mediaCapture.isScreenSharing, mediaCapture.screenStream]);

  return {
    state,
    initiateCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    flipCamera,
    setVirtualBackground,
    setCallEffects,
    setAudioProcessing,
    raiseHand,
    sendReaction,
    getUserMedia,
    setRemoteVideoRef,
    playRemoteVideo,
    markUserInteracted: autoplay.markUserInteracted,
  };
}
