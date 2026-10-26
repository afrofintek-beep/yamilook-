/**
 * useMediaCapture - Handles getUserMedia and local stream management
 * Responsible for capturing audio/video from user devices
 */
import { useState, useRef, useCallback } from 'react';
import { CallSettings } from './types';
import { isMediaPermissionDenied } from './call-preflight';
import { logger } from '@/lib/logger';

export interface UseMediaCaptureReturn {
  localStream: MediaStream | null;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  screenStream: MediaStream | null;
  screenStreamRef: React.MutableRefObject<MediaStream | null>;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  getUserMedia: (settings: CallSettings) => Promise<MediaStream>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  flipCamera: () => Promise<void>;
  stopAllMedia: () => void;
  replaceTrackInPeerConnections: (
    newTrack: MediaStreamTrack,
    kind: 'audio' | 'video',
    peerConnections: Map<string, RTCPeerConnection>
  ) => void;
}

export function useMediaCapture(): UseMediaCaptureReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  /**
   * Get user media (camera/microphone)
   */
  const getUserMedia = useCallback(async (settings: CallSettings): Promise<MediaStream> => {
    logger.debug('Getting user media', 'MediaCapture', settings);

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression,
      autoGainControl: true,
    };

    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      facingMode: 'user',
      frameRate: { ideal: 30, max: 60 },
    };

    // Helper to attempt getUserMedia and store result
    const tryGetStream = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      const hasVideo = stream.getVideoTracks().length > 0;
      setIsVideoEnabled(hasVideo);
      setIsMuted(!settings.audioEnabled);
      logger.debug('Got local stream', 'MediaCapture', stream.getTracks().map((t) => `${t.kind}:${t.enabled}`));
      return stream;
    };

    // Attempt 1: requested constraints (video + audio or audio-only)
    try {
      return await tryGetStream({
        video: settings.videoEnabled ? videoConstraints : false,
        audio: settings.audioEnabled ? audioConstraints : false,
      });
    } catch (err1) {
      logger.warn('First getUserMedia attempt failed', 'MediaCapture', err1);

      // Respect an explicit refusal; retries can cause repeated permission prompts.
      if (isMediaPermissionDenied(err1)) throw err1;

      // Attempt 2: if video was requested, fall back to audio-only
      if (settings.videoEnabled) {
        logger.warn('Retrying with audio-only fallback...', 'MediaCapture');
        try {
          return await tryGetStream({
            video: false,
            audio: settings.audioEnabled ? audioConstraints : false,
          });
        } catch (err2) {
          if (isMediaPermissionDenied(err2)) throw err2;
          logger.warn('Audio-only fallback also failed, trying bare audio...', 'MediaCapture', err2);
        }
      }

      // Attempt 3: bare audio (no constraints) as last resort
      try {
        return await tryGetStream({ video: false, audio: true });
      } catch (err3) {
        logger.error('All getUserMedia attempts failed', 'MediaCapture', err3);
        throw err3;
      }
    }
  }, []);

  /**
   * Toggle audio mute
   */
  const toggleMute = useCallback(() => {
    logger.debug('toggleMute called', 'MediaCapture', { localStreamExists: !!localStreamRef.current });

    if (!localStreamRef.current) {
      logger.warn('No local stream available for mute toggle', 'MediaCapture');
      setIsMuted(prev => !prev);
      return;
    }

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const newMuted = !audioTrack.enabled;
      logger.debug('Toggled mute', 'MediaCapture', newMuted);
      setIsMuted(newMuted);
    } else {
      logger.warn('No audio track found in local stream', 'MediaCapture');
    }
  }, []);

  /**
   * Toggle video on/off
   */
  const toggleVideo = useCallback(() => {
    logger.debug('toggleVideo called', 'MediaCapture', { localStreamExists: !!localStreamRef.current });

    if (!localStreamRef.current) {
      logger.warn('No local stream available for video toggle', 'MediaCapture');
      setIsVideoEnabled(prev => !prev);
      return;
    }

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const newEnabled = videoTrack.enabled;
      logger.debug('Toggled video', 'MediaCapture', newEnabled);
      setIsVideoEnabled(newEnabled);
    } else {
      logger.warn('No video track found in local stream', 'MediaCapture');
    }
  }, []);

  /**
   * Toggle screen sharing
   */
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);
    } else {
      // Screen capture is unavailable on most mobile browsers (iOS Safari,
      // Android Chrome). Signal that clearly instead of failing silently.
      if (!navigator.mediaDevices?.getDisplayMedia) {
        const e = new Error('Partilha de ecrã não é suportada neste dispositivo (ex.: telemóveis).');
        e.name = 'ScreenShareUnsupported';
        throw e;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: true,
        });
      } catch (error) {
        logger.error('Error starting screen share', 'MediaCapture', error);
        const name = (error as Error)?.name;
        // User cancelled the picker → stay silent; otherwise surface the error.
        if (name === 'NotAllowedError' || name === 'AbortError') return;
        throw error;
      }

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      // Handle stop from browser UI
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => {
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setScreenStream(null);
        setIsScreenSharing(false);
      };
    }
  }, [isScreenSharing]);

  /**
   * Flip camera (front/back on mobile)
   */
  const flipCamera = useCallback(async () => {
    if (!localStreamRef.current) return;

    const currentTrack = localStreamRef.current.getVideoTracks()[0];
    if (!currentTrack) return;

    const settings = currentTrack.getSettings();
    const newFacingMode = settings.facingMode === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace in local stream
      localStreamRef.current.removeTrack(currentTrack);
      localStreamRef.current.addTrack(newVideoTrack);
      currentTrack.stop();

      // Trigger re-render
      setLocalStream(localStreamRef.current);
    } catch (error) {
      logger.error('Error flipping camera', 'MediaCapture', error);
    }
  }, []);

  /**
   * Stop all media tracks
   */
  const stopAllMedia = useCallback(() => {
    logger.debug('Stopping all media', 'MediaCapture');
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
  }, []);

  /**
   * Replace a track in all peer connections
   */
  const replaceTrackInPeerConnections = useCallback((
    newTrack: MediaStreamTrack,
    kind: 'audio' | 'video',
    peerConnections: Map<string, RTCPeerConnection>
  ) => {
    peerConnections.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === kind);
      if (sender) {
        sender.replaceTrack(newTrack);
      }
    });
  }, []);

  return {
    localStream,
    localStreamRef,
    screenStream,
    screenStreamRef,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    getUserMedia,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    flipCamera,
    stopAllMedia,
    replaceTrackInPeerConnections,
  };
}
