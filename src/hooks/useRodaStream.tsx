import { uiText } from '@/i18n/ui-copy';
/* @refresh reset */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Track,
  LocalTrack,
  ConnectionState,
  VideoPresets,
  createLocalTracks
} from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface UseRodaStreamReturn {
  room: Room | null;
  connectionState: ConnectionState;
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
  isHost: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  connectAsHost: (roomName: string) => Promise<boolean>;
  connectAsViewer: (roomName: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
  flipCamera: () => Promise<void>;

  // Stream state
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
}

export function useRodaStream(): UseRodaStreamReturn {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);

  const roomRef = useRef<Room | null>(null);
  const isHostRef = useRef(false);
  const currentFacingMode = useRef<'user' | 'environment'>('user');

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        console.log('[RodaStream] Cleanup - disconnecting');
        roomRef.current.disconnect();
      }
    };
  }, []);

  const getToken = useCallback(async (roomName: string, isHostUser: boolean): Promise<{ token: string; url: string } | null> => {
    if (!user || !profile) return null;

    const participantIdentity = isHostUser
      ? `host:${(user.id)}`
      : `viewer:${(user.id)}:${(Date.now())}`;
    const body = { roomName, participantName: profile.display_name || 'User', participantIdentity, isHost: isHostUser };

    // Retry: the token edge function can cold-start slowly after a lull.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('generate-livekit-token', { body });
        if (error) throw error;
        if (data?.token) return { token: data.token, url: data.url };
        throw new Error(uiText("No token in response"));
      } catch (err) {
        lastError = err;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      }
    }
    console.error('[RodaStream] Token error:', lastError);
    return null;
  }, [user, profile]);

  const setupRoom = useCallback((newRoom: Room) => {
    newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
      console.log('[RodaStream] Connection state:', state);
      setConnectionState(state);
    });

    newRoom.on(RoomEvent.Connected, () => {
      console.log('[RodaStream] Connected to room:', newRoom.name);
      // Update remote participants on connect (they may already be there)
      setRemoteParticipants([...newRoom.remoteParticipants.values()]);
    });

    newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('[RodaStream] Participant joined:', participant.identity);
      setRemoteParticipants([...newRoom.remoteParticipants.values()]);
    });

    newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('[RodaStream] Participant left:', participant.identity);
      setRemoteParticipants([...newRoom.remoteParticipants.values()]);
    });

    newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('[RodaStream] Track subscribed:', track.kind, 'from', participant.identity, 'sid:', track.sid);
      // Force a fresh copy to trigger React re-render
      setRemoteParticipants((prev) => {
        const updated = [...newRoom.remoteParticipants.values()];
        console.log('[RodaStream] Updated remote participants:', updated.length);
        return updated;
      });
    });

    newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('[RodaStream] Track unsubscribed:', track.kind);
      setRemoteParticipants([...newRoom.remoteParticipants.values()]);
    });

    newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
      console.log('[RodaStream] Track published (remote):', publication.kind, 'from', participant.identity);
      setRemoteParticipants([...newRoom.remoteParticipants.values()]);
    });

    newRoom.on(RoomEvent.LocalTrackPublished, (publication) => {
      console.log('[RodaStream] Local track published:', publication.kind);
      setLocalParticipant(newRoom.localParticipant);
    });

    newRoom.on(RoomEvent.Disconnected, (reason) => {
      console.log('[RodaStream] Disconnected, reason:', reason);
      setRoom(null);
      setLocalParticipant(null);
      setRemoteParticipants([]);
      setConnectionState(ConnectionState.Disconnected);
    });
  }, []);

  const connectAsHost = useCallback(async (roomName: string): Promise<boolean> => {
    if (!user) {
      setError(uiText("Por favor, faça login para transmitir"));
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Get credentials
      const credentials = await getToken(roomName, true);
      if (!credentials) {
        setError(uiText("Falha ao obter credenciais de transmissão"));
        setLoading(false);
        return false;
      }

      // Create room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
          facingMode: 'user',
        },
      });

      setupRoom(newRoom);
      roomRef.current = newRoom;

      // Connect
      console.log('[RodaStream] Connecting as host to:', credentials.url);
      await newRoom.connect(credentials.url, credentials.token);

      // Capture and publish media
      console.log('[RodaStream] Capturing local tracks...');
      const tracks = await createLocalTracks({
        audio: true,
        video: {
          resolution: VideoPresets.h720.resolution,
          facingMode: 'user',
        },
      });

      console.log('[RodaStream] Publishing tracks:', tracks.length);
      for (const track of tracks) {
        await newRoom.localParticipant.publishTrack(track);
      }

      setRoom(newRoom);
      setLocalParticipant(newRoom.localParticipant);
      setIsHost(true);
      setIsCameraEnabled(true);
      setIsMicrophoneEnabled(true);
      setLoading(false);

      toast({
        title: uiText("Transmissão iniciada!"),
        description: uiText("Você está ao vivo."),
      });

      return true;
    } catch (err) {
      console.error('[RodaStream] Host connection failed:', err);
      setError(uiText("Falha ao conectar. Verifique sua câmera e microfone."));
      setLoading(false);
      return false;
    }
  }, [user, getToken, setupRoom, toast]);

  const connectAsViewer = useCallback(async (roomName: string): Promise<boolean> => {
    if (!user) {
      setError(uiText("Por favor, faça login para assistir"));
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const credentials = await getToken(roomName, false);
      if (!credentials) {
        setError(uiText("Falha ao obter credenciais"));
        setLoading(false);
        return false;
      }

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      setupRoom(newRoom);
      roomRef.current = newRoom;

      console.log('[RodaStream] Connecting as viewer to:', credentials.url);
      await newRoom.connect(credentials.url, credentials.token);

      setRoom(newRoom);
      setRemoteParticipants([...newRoom.remoteParticipants.values()]);
      setIsHost(false);
      setLoading(false);

      return true;
    } catch (err) {
      console.error('[RodaStream] Viewer connection failed:', err);
      setError(uiText("Falha ao conectar à transmissão"));
      setLoading(false);
      return false;
    }
  }, [user, getToken, setupRoom]);

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      console.log('[RodaStream] Disconnecting...');
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setRoom(null);
    setLocalParticipant(null);
    setRemoteParticipants([]);
    setIsHost(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    if (!room || !room.localParticipant) return;

    const enabled = room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(!enabled);
    setIsCameraEnabled(!enabled);
  }, [room]);

  const toggleMicrophone = useCallback(async () => {
    if (!room || !room.localParticipant) return;

    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    setIsMicrophoneEnabled(!enabled);
  }, [room]);

  const flipCamera = useCallback(async () => {
    if (!room || !room.localParticipant) return;

    try {
      const newFacingMode = currentFacingMode.current === 'user' ? 'environment' : 'user';

      // Find current camera track publication
      const cameraPub = [...room.localParticipant.videoTrackPublications.values()]
        .find(p => p.source === Track.Source.Camera && p.track);

      if (cameraPub?.track) {
        // Use restartTrack to swap facingMode in-place (preserves gesture context)
        await (cameraPub.track as LocalTrack).restartTrack({
          facingMode: newFacingMode,
        });
        currentFacingMode.current = newFacingMode;
        setLocalParticipant(room.localParticipant);
        console.log('[RodaStream] Camera flipped to:', newFacingMode);
      } else {
        console.warn('[RodaStream] No camera track found to flip');
      }
    } catch (err) {
      console.error('[RodaStream] Failed to flip camera:', err);
    }
  }, [room]);

  return {
    room,
    connectionState,
    localParticipant,
    remoteParticipants,
    isHost,
    loading,
    error,
    connectAsHost,
    connectAsViewer,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    flipCamera,
    isCameraEnabled,
    isMicrophoneEnabled,
  };
}
