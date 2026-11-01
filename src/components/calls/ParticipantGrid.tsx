import React from 'react';
import { CallRemoteMedia, CallVideoOnly } from './CallRemoteMedia';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MicOff, Hand, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface Participant {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_muted: boolean;
  is_video_enabled: boolean;
  is_screen_sharing: boolean;
  is_hand_raised: boolean;
  is_spotlight: boolean;
}

interface ParticipantGridProps {
  participants: Participant[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  screenStream: MediaStream | null;
  remoteScreenStreams?: Map<string, MediaStream>;
  isScreenSharing: boolean;
  callType: 'voice' | 'video';
  onSelectParticipant?: () => void;
}


export function ParticipantGrid({
  participants,
  localStream,
  remoteStreams,
  screenStream,
  remoteScreenStreams,
  isScreenSharing,
  callType,
  onSelectParticipant,
}: ParticipantGridProps) {
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  // CRITICAL: Merge database participants with any streams we have
  // This ensures we show video/audio even if DB hasn't synced yet
  const participantUserIds = new Set(participants.map(p => p.user_id));
  const streamOnlyUserIds = Array.from(remoteStreams.keys()).filter(userId => !participantUserIds.has(userId));
  
  // Create placeholder participants for streams without DB entries
  const streamOnlyParticipants: Participant[] = streamOnlyUserIds.map(userId => ({
    id: `stream-${userId}`,
    user_id: userId,
    display_name: 'Participante',
    avatar_url: null,
    is_muted: false,
    is_video_enabled: true,
    is_screen_sharing: false,
    is_hand_raised: false,
    is_spotlight: false,
  }));
  
  const allParticipants = [...participants, ...streamOnlyParticipants];

  React.useEffect(() => {
    if (selectedUserId && !participants.some(p => p.user_id === selectedUserId) && !remoteStreams.has(selectedUserId)) {
      setSelectedUserId(null);
    }
  }, [participants, remoteStreams, selectedUserId]);
  const selectParticipant = (userId: string) => {
    setSelectedUserId(userId);
    onSelectParticipant?.();
  };

  // Debug logging - MUST be before any conditional returns
  React.useEffect(() => {
    logger.debug('Grid state', 'ParticipantGrid', {
      participants: participants.map(p => p.user_id),
      remoteStreamKeys: Array.from(remoteStreams.keys()),
      allParticipants: allParticipants.length,
    });
  }, [participants, remoteStreams, allParticipants.length]);

  // Determine grid layout based on participant count
  const getGridClass = () => {
    // Local user is rendered as PiP overlay in VideoCall, not in this grid
    const count = allParticipants.length;
    
    if (isScreenSharing) {
      return 'grid-cols-1';
    }
    
    switch (count) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
      case 4:
        return 'grid-cols-2 grid-rows-2';
      case 5:
      case 6:
        return 'grid-cols-3 grid-rows-2';
      case 7:
      case 8:
      case 9:
        return 'grid-cols-3 grid-rows-3';
      default:
        return 'grid-cols-4 auto-rows-fr';
    }
  };

  // Get spotlight participant if any
  const spotlightParticipant = allParticipants.find(p => p.user_id === selectedUserId)
    ?? allParticipants.find(p => p.is_spotlight);

  // Screen video is separate from cameras; participant tiles stay mounted below it.
  const sharedScreen = remoteScreenStreams?.values().next().value ?? (isScreenSharing ? screenStream : null);
  const hasScreen = !!sharedScreen;
  const hasFocus = hasScreen || (!!spotlightParticipant && allParticipants.length > 1);
  const columns = Math.max(1, hasScreen ? allParticipants.length : allParticipants.length - 1);

  // Standard grid view
  // For 1-on-1 calls, skip grid padding so the remote video fills the entire screen
  const isSingleRemote = allParticipants.length === 1;

  return (
    <div className={cn(
      "relative w-full h-full grid",
      hasFocus ? "grid-cols-1 grid-rows-[minmax(0,1fr)_6rem] gap-1" : isSingleRemote ? "grid-cols-1" : cn("gap-1 p-2", getGridClass())
    )} style={hasFocus ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
      {sharedScreen && <div key="shared-screen" data-testid="shared-screen" className="relative min-h-0 min-w-0 row-start-1 bg-black" style={{ gridColumn: `1 / ${columns + 1}` }}>
        <CallVideoOnly stream={sharedScreen} contain />
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white">Ecrã partilhado</span>
      </div>}
      {selectedUserId && !isSingleRemote && !hasScreen && (
        <button type="button" onClick={() => setSelectedUserId(null)} className="absolute left-3 bottom-28 z-20 rounded-full bg-black/70 px-3 py-2 text-sm text-white">
          Ver todos
        </button>
      )}
      {/* Remote participants (from DB + stream-only) */}
      {allParticipants.map(participant => (
        <div key={participant.user_id}
          className={cn("relative min-h-0 min-w-0", hasFocus && (!hasScreen && participant.user_id === spotlightParticipant?.user_id ? "row-start-1 col-start-1" : "row-start-2"))}
          style={hasFocus && !hasScreen && participant.user_id === spotlightParticipant?.user_id ? { gridColumn: `1 / ${columns + 1}` } : undefined}
        >
          <ParticipantTile
            participant={participant}
            stream={remoteStreams.get(participant.user_id)}
            callType={callType}
            isSpotlight={participant.user_id === spotlightParticipant?.user_id}
            onSelect={() => selectParticipant(participant.user_id)}
          />
        </div>
      ))}
      
      {/* Local user (if only one, show full screen) */}
      {!hasScreen && allParticipants.length === 0 && localStream && callType === 'video' && (
        <div className="relative w-full h-full bg-muted overflow-hidden">
          <video
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            ref={(el) => {
              if (el) el.srcObject = localStream;
            }}
          />
          <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
            You
          </div>
        </div>
      )}
    </div>
  );
}

interface ParticipantTileProps {
  participant: Participant;
  stream?: MediaStream;
  callType: 'voice' | 'video';
  isSpotlight?: boolean;
  onSelect?: () => void;
}

function ParticipantTile({ participant, stream, callType, isSpotlight, onSelect }: ParticipantTileProps) {
  // Check if stream has active video track - don't rely only on database state
  const hasVideoTrack = stream?.getVideoTracks().some(track => track.enabled && track.readyState === 'live');
  const hasAudioTrack = stream?.getAudioTracks().some(track => track.enabled);
  const showVideo = !!stream && !!hasVideoTrack;
  const hasStream = !!stream;

  // Log stream state for debugging
  React.useEffect(() => {
    if (stream) {
      logger.debug('Stream for participant', 'ParticipantTile', {
        displayName: participant.display_name,
        videoTracks: stream.getVideoTracks().map(t => ({ enabled: t.enabled, readyState: t.readyState })),
        audioTracks: stream.getAudioTracks().map(t => ({ enabled: t.enabled, readyState: t.readyState })),
      });
    }
  }, [stream, participant.display_name]);

  return (
    <div className={cn(
      "relative w-full h-full bg-muted rounded-lg overflow-hidden",
      isSpotlight && "border-2 border-primary"
    )}>
      {/* Always render video/audio element if we have a stream - even for voice calls (for audio) */}
      {hasStream && <CallRemoteMedia stream={stream!} showVideo={showVideo} />}
      
      {/* Show avatar when no video (or voice call) */}
      {!showVideo && (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
          <Avatar className={cn(
            "border-4 border-background/20",
            isSpotlight ? "h-32 w-32" : "h-20 w-20"
          )}>
            <AvatarImage src={participant.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">
              {participant.display_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <button type="button" onClick={onSelect}
        aria-label={`Ampliar ${participant.display_name}`}
        aria-pressed={!!isSpotlight}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      />
      {/* Participant info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium truncate">
            {participant.display_name}
          </span>
          <div className="flex items-center gap-2">
            {participant.is_hand_raised && (
              <div className="p-1 rounded-full bg-yellow-500">
                <Hand className="h-3 w-3 text-black" />
              </div>
            )}
            {participant.is_spotlight && (
              <div className="p-1 rounded-full bg-primary">
                <Pin className="h-3 w-3 text-white" />
              </div>
            )}
            {participant.is_muted && (
              <div className="p-1 rounded-full bg-red-500">
                <MicOff className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Speaking indicator */}
      <div className="absolute inset-0 border-4 border-transparent rounded-lg pointer-events-none" />
    </div>
  );
}
