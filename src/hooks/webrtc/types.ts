/**
 * WebRTC Type Definitions
 * Shared types for the WebRTC hook system
 */

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

export interface CallState {
  callId: string | null;
  isInitiator: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  screenStream: MediaStream | null;
  remoteScreenStreams?: Map<string, MediaStream>;
  connectionState: RTCPeerConnectionState;
  callStatus: 'idle' | 'initiating' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'failed' | 'declined';
  targetUserId: string | null;
  callType: 'voice' | 'video';
  lastError: string | null;
}

export interface CallSettings {
  videoEnabled: boolean;
  audioEnabled: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
}

export const INITIAL_STATE: CallState = {
  callId: null,
  isInitiator: false,
  localStream: null,
  remoteStreams: new Map(),
  isMuted: false,
  isVideoEnabled: true,
  isScreenSharing: false,
  screenStream: null,
  connectionState: 'new',
  callStatus: 'idle',
  targetUserId: null,
  callType: 'video',
  lastError: null,
};

/**
 * WebRTC telemetry metrics emitted during calls
 */
export interface CallMetrics {
  callId: string;
  peerConnectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  selectedCandidatePair: {
    localType: string | null;
    remoteType: string | null;
    localProtocol: string | null;
    remoteProtocol: string | null;
  } | null;
  bitrate: {
    audio: number;
    video: number;
  };
  packetLoss: {
    audio: number;
    video: number;
  };
  reconnectAttempts: number;
  callDurationMs: number;
  callEndReason: string | null;
  timestamp: number;
}

/**
 * Configuration for WebRTC
 */
export interface WebRTCConfig {
  ringTimeoutMs: number;
  iceTransportPolicy: RTCIceTransportPolicy;
}

/**
 * Get WebRTC configuration from environment
 */
export function getWebRTCConfig(): WebRTCConfig {
  const ringTimeout = typeof import.meta !== 'undefined' 
    ? (import.meta.env?.VITE_CALL_RING_TIMEOUT ?? 60000)
    : 60000;
    
  const icePolicy = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_ICE_TRANSPORT_POLICY ?? 'all')
    : 'all';

  return {
    ringTimeoutMs: Number(ringTimeout),
    iceTransportPolicy: icePolicy as RTCIceTransportPolicy,
  };
}
