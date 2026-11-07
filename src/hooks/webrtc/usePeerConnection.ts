import { uiText } from '@/i18n/ui-copy';
/**
 * usePeerConnection - Creates and manages RTCPeerConnection instances
 * Handles ICE, track management, connection state, and recovery ladder.
 *
 * CRITICAL FIX: accepts getter functions (getIceServers / getLocalStream) so
 * the RTCPeerConnection is always constructed with the *latest* values,
 * eliminating the stale-closure bug where an empty ICE server list was baked in.
 */
import { useRef, useCallback, useEffect } from 'react';
import { getWebRTCConfig } from './types';
import { logger } from '@/lib/logger';

// --------------- Recovery constants ---------------
const DISCONNECTED_TIMEOUT_MS = 5_000;
const CONNECTING_WATCHDOG_MS = 15_000;
const MAX_RECOVERY_ATTEMPTS = 3;

export interface UsePeerConnectionOptions {
  /** Returns the latest ICE servers at call time */
  getIceServers: () => RTCIceServer[];
  /** Returns the latest local MediaStream at call time */
  getLocalStream: () => MediaStream | null;
  callIdRef: React.MutableRefObject<string | null>;
  onIceCandidate: (peerId: string, candidate: RTCIceCandidateInit) => void;
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceStateChange: (state: RTCIceConnectionState) => void;
  onNegotiationNeeded: (peerId: string, pc: RTCPeerConnection) => Promise<void>;
  /** Called when the recovery ladder needs a full renegotiation from the orchestrator */
  onRecoveryRenegotiate?: (peerId: string, pc: RTCPeerConnection) => Promise<void>;
  onMetricsUpdate?: (pc: RTCPeerConnection, peerId: string) => void;
}

export interface UsePeerConnectionReturn {
  peerConnections: React.MutableRefObject<Map<string, RTCPeerConnection>>;
  createPeerConnection: (peerId: string) => RTCPeerConnection;
  getPeerConnection: (peerId: string) => RTCPeerConnection | undefined;
  closePeerConnection: (peerId: string) => void;
  closeAllPeerConnections: () => void;
  addLocalTracks: (peerId: string, stream: MediaStream) => void;
  /** Manually trigger recovery for a peer (e.g. from orchestrator) */
  attemptRecovery: (peerId: string) => void;
}

export function usePeerConnection(options: UsePeerConnectionOptions): UsePeerConnectionReturn {
  const {
    getIceServers,
    getLocalStream,
    callIdRef,
    onIceCandidate,
    onRemoteStream,
    onConnectionStateChange,
    onIceStateChange,
    onNegotiationNeeded,
    onRecoveryRenegotiate,
    onMetricsUpdate,
  } = options;

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const recoveryAttempts = useRef<Map<string, number>>(new Map());
  const disconnectedTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const connectingWatchdogs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const config = getWebRTCConfig();

  // Keep latest callbacks in refs to avoid re-creating createPeerConnection
  const cbRef = useRef(options);
  cbRef.current = options;

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      disconnectedTimers.current.forEach(t => clearTimeout(t));
      connectingWatchdogs.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // ─── Recovery ladder ──────────────────────────────────────────
  const runRecoveryLadder = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (!pc) return;

    const attempts = recoveryAttempts.current.get(peerId) ?? 0;
    recoveryAttempts.current.set(peerId, attempts + 1);

    if (attempts >= MAX_RECOVERY_ATTEMPTS) {
      logger.error('❌ Recovery exhausted', 'PeerConnection', { maxAttempts: MAX_RECOVERY_ATTEMPTS, peerId });
      cbRef.current.onConnectionStateChange('failed');
      return;
    }

    if (attempts === 0) {
      // Step 1: ICE restart
      logger.debug('🔄 Recovery step 1/3: restartIce() for', 'PeerConnection', peerId);
      pc.restartIce();
    } else if (attempts === 1) {
      // Step 2: Full renegotiation (new offer/answer via orchestrator)
      logger.debug('🔄 Recovery step 2/3: renegotiation for', 'PeerConnection', peerId);
      if (cbRef.current.onRecoveryRenegotiate) {
        cbRef.current.onRecoveryRenegotiate(peerId, pc).catch(err => {
          logger.error('Recovery renegotiation failed', 'PeerConnection', err);
        });
      } else {
        // Fallback to restartIce again if no renegotiate handler
        pc.restartIce();
      }
    } else {
      // Step 3: Rebuild peer connection entirely
      logger.debug('🔄 Recovery step 3/3: rebuilding PeerConnection for', 'PeerConnection', peerId);
      rebuildPeerConnection(peerId);
    }
  }, []);

  // Stable ref so rebuildPeerConnection never captures a stale createPeerConnection
  const createPeerConnectionRef = useRef<(peerId: string) => RTCPeerConnection>(() => {
    throw new Error(uiText("createPeerConnection not ready"));
  });

  /**
   * Rebuild: close old PC, create new one, re-add tracks, trigger renegotiation.
   */
  const rebuildPeerConnection = useCallback((peerId: string) => {
    const oldPc = peerConnections.current.get(peerId);
    if (oldPc) {
      oldPc.onicecandidate = null;
      oldPc.oniceconnectionstatechange = null;
      oldPc.onconnectionstatechange = null;
      oldPc.ontrack = null;
      oldPc.onnegotiationneeded = null;
      oldPc.close();
      peerConnections.current.delete(peerId);
    }
    // Create fresh via ref (always latest) — onnegotiationneeded will fire
    createPeerConnectionRef.current(peerId);
  }, []);

  // ─── Watchdog / disconnected helpers ──────────────────────────
  const clearTimersForPeer = useCallback((peerId: string) => {
    const dt = disconnectedTimers.current.get(peerId);
    if (dt) { clearTimeout(dt); disconnectedTimers.current.delete(peerId); }
    const wt = connectingWatchdogs.current.get(peerId);
    if (wt) { clearTimeout(wt); connectingWatchdogs.current.delete(peerId); }
  }, []);

  const startConnectingWatchdog = useCallback((peerId: string) => {
    // Clear existing
    const existing = connectingWatchdogs.current.get(peerId);
    if (existing) clearTimeout(existing);

    const t = setTimeout(() => {
      const pc = peerConnections.current.get(peerId);
      if (pc && (pc.connectionState === 'connecting' || pc.connectionState === 'new')) {
        logger.warn('⏰ Connecting watchdog fired', 'PeerConnection', { peerId, state: pc.connectionState });
        runRecoveryLadder(peerId);
      }
    }, CONNECTING_WATCHDOG_MS);
    connectingWatchdogs.current.set(peerId, t);
  }, [runRecoveryLadder]);

  /**
   * Create a new RTCPeerConnection for a peer
   */
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    // Read LATEST values via getters
    const iceServers = cbRef.current.getIceServers();
    const localStream = cbRef.current.getLocalStream();

    logger.debug('🔧 Creating peer connection', 'PeerConnection', { peerId, iceServersCount: iceServers.length, iceTransportPolicy: config.iceTransportPolicy });

    if (!localStream) {
      logger.error('❌ CRITICAL: No local stream when creating peer connection!', 'PeerConnection');
    } else {
      const tracks = localStream.getTracks();
      logger.debug('🔧 Local stream tracks', 'PeerConnection', tracks.map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        id: t.id.substring(0, 8)
      })));
    }

    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: config.iceTransportPolicy,
    });

    // Log ICE servers used
    iceServers.forEach((server, i) => {
      const urls = typeof server.urls === 'string' ? server.urls : server.urls[0];
      const hasCredentials = !!server.username && !!server.credential;
      logger.debug(`🧊   ${i + 1}. ${urls?.substring(0, 50)}... (auth: ${hasCredentials})`, 'PeerConnection');
    });

    // Reset recovery counter for this peer
    recoveryAttempts.current.set(peerId, 0);

    // Add local tracks BEFORE any offer/answer.
    // CRITICAL: addTrack() creates sendrecv transceivers automatically.
    // Do NOT combine with offerToReceiveAudio/Video legacy options in createOffer(),
    // as they create extra recvonly transceivers that suppress the sender side.
    if (localStream) {
      const tracks = localStream.getTracks();
      logger.debug('➕ Adding local tracks to PC', 'PeerConnection', tracks.length);
      tracks.forEach(track => {
        // Log the actual hardware-level muted state (read-only, set by browser/OS).
        // track.muted=true means the OS/browser is not providing data (e.g. mic not granted).
        // track.enabled=false means we manually muted via toggleMute().
        logger.debug(`➕ track: kind=${track.kind} enabled=${track.enabled} muted=${track.muted} readyState=${track.readyState}`, 'PeerConnection');
        if (track.kind === 'audio' && track.muted) {
          logger.warn('⚠️ Audio track is hardware-muted (track.muted=true). Check OS/browser microphone permissions.', 'PeerConnection');
        }
        pc.addTrack(track, localStream);
      });
    }

    // ── ICE candidate handler ──
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      cbRef.current.onIceCandidate(peerId, candidate);
    };

    // ── ICE connection state ──
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      logger.debug('🧊 ICE state', 'PeerConnection', { iceState, peer: peerId });
      cbRef.current.onIceStateChange(iceState);

      if (iceState === 'connected' || iceState === 'completed') {
        clearTimersForPeer(peerId);
        recoveryAttempts.current.set(peerId, 0);
        if (cbRef.current.onMetricsUpdate) cbRef.current.onMetricsUpdate(pc, peerId);
      }

      if (iceState === 'failed') {
        logger.error('❌ ICE FAILED for', 'PeerConnection', peerId);
        runRecoveryLadder(peerId);
      } else if (iceState === 'disconnected') {
        logger.warn('⚠️ ICE disconnected for', 'PeerConnection', peerId);
        // Start timer — if still disconnected after timeout, run recovery
        const t = setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            runRecoveryLadder(peerId);
          }
        }, DISCONNECTED_TIMEOUT_MS);
        disconnectedTimers.current.set(peerId, t);
      }
    };

    // ── Remote tracks ──
    pc.ontrack = (event) => {
      logger.debug('🎵 Remote track', 'PeerConnection', { kind: event.track.kind, peer: peerId, enabled: event.track.enabled });
      let stream = event.streams[0];
      if (!stream) {
        stream = new MediaStream();
        stream.addTrack(event.track);
      }
      cbRef.current.onRemoteStream(peerId, stream);
    };

    // ── Connection state ──
    pc.onconnectionstatechange = () => {
      const connState = pc.connectionState;
      logger.debug('🔌 Connection state', 'PeerConnection', { connState, peer: peerId });
      cbRef.current.onConnectionStateChange(connState);

      if (connState === 'connected') {
        clearTimersForPeer(peerId);
        recoveryAttempts.current.set(peerId, 0);
      } else if (connState === 'connecting') {
        startConnectingWatchdog(peerId);
      } else if (connState === 'failed') {
        clearTimersForPeer(peerId);
        runRecoveryLadder(peerId);
      } else if (connState === 'disconnected') {
        // Handled by ICE handler above
      }
    };

    // ── Signaling state ──
    pc.onsignalingstatechange = () => {
      logger.debug('📡 Signaling state', 'PeerConnection', pc.signalingState);
    };

    // ── Negotiation needed ──
    pc.onnegotiationneeded = async () => {
      if (pc.signalingState !== 'stable') return;
      // CRITICAL: Don't fire during initial setup (track-add before any offer/answer).
      // Both initiator and callee create offers manually; onnegotiationneeded is
      // only needed for renegotiation (screen-share, camera switch) which happens
      // AFTER the initial handshake when remoteDescription is already set.
      if (!pc.remoteDescription) {
        logger.debug('ℹ️ Suppressing premature onnegotiationneeded (no remoteDescription yet)', 'PeerConnection');
        return;
      }
      const callId = cbRef.current.callIdRef.current;
      if (!callId) return;
      await cbRef.current.onNegotiationNeeded(peerId, pc);
    };

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [config.iceTransportPolicy, clearTimersForPeer, startConnectingWatchdog, runRecoveryLadder]);

  // Keep ref in sync so rebuildPeerConnection always calls the latest version
  useEffect(() => {
    createPeerConnectionRef.current = createPeerConnection;
  }, [createPeerConnection]);

  const getPeerConnection = useCallback((peerId: string): RTCPeerConnection | undefined => {
    return peerConnections.current.get(peerId);
  }, []);

  const closePeerConnection = useCallback((peerId: string) => {
    clearTimersForPeer(peerId);
    recoveryAttempts.current.delete(peerId);
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.close();
      peerConnections.current.delete(peerId);
    }
  }, [clearTimersForPeer]);

  const closeAllPeerConnections = useCallback(() => {
    logger.debug('Closing all peer connections', 'PeerConnection');
    peerConnections.current.forEach((_pc, peerId) => closePeerConnection(peerId));
    peerConnections.current.clear();
    recoveryAttempts.current.clear();
  }, [closePeerConnection]);

  const addLocalTracks = useCallback((peerId: string, stream: MediaStream) => {
    const pc = peerConnections.current.get(peerId);
    if (!pc) return;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, []);

  const attemptRecovery = useCallback((peerId: string) => {
    runRecoveryLadder(peerId);
  }, [runRecoveryLadder]);

  return {
    peerConnections,
    createPeerConnection,
    getPeerConnection,
    closePeerConnection,
    closeAllPeerConnections,
    addLocalTracks,
    attemptRecovery,
  };
}
