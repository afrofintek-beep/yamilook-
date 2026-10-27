import React from 'react';
import { CallRemoteMedia } from './CallRemoteMedia';
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
  isScreenSharing: boolean;
  callType: 'voice' | 'video';
}

export function ParticipantGrid({
  participants,
  localStream,
  remoteStreams,
  screenStream,
  isScreenSharing,
  callType,
}: ParticipantGridProps) {
  // CRITICAL: Merge database participants with any streams we have
  // This ensures we show video/audio even if DB hasn't synced yet
  const participantUserIds = new Set(participants.map(p => p.user_id));
  const streamOnlyUserIds = Array.from(remoteStreams.keys()).filter(userId => !participantUserIds.has(userId));
  
  // Create placeholder participants for streams without DB entries
  const streamOnlyParticipants: Participant[] = streamOnlyUserIds.map(userId => ({
    id: `stream-${userId}`,
    user_id: userId,
    display_name: 'Connecting...',
    avatar_url: null,
    is_muted: false,
    is_video_enabled: true,
    is_screen_sharing: false,
    is_hand_raised: false,
    is_spotlight: false,
  }));
  
  const allParticipants = [...participants, ...streamOnlyParticipants];

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
  const spotlightParticipant = allParticipants.find(p => p.is_spotlight);

  // Screen sharing takes priority
  if (isScreenSharing && screenStream) {
    return (
      <div className="w-full h-full flex flex-col">
        {/* Main screen share view */}
        <div className="flex-1 relative">
          <video
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-black"
            ref={(el) => {
              if (el) el.srcObject = screenStream;
            }}
          />
          <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
            Screen Sharing
          </div>
        </div>
        
        {/* Participant strip at bottom */}
        <div className="h-24 bg-background/50 flex items-center gap-2 px-4 overflow-x-auto">
          {allParticipants.map(participant => (
            <ParticipantThumbnail
              key={participant.id}
              participant={participant}
              stream={remoteStreams.get(participant.user_id)}
              callType={callType}
              isSmall
            />
          ))}
        </div>
      </div>
    );
  }

  // Spotlight view
  if (spotlightParticipant) {
    return (
      <div className="w-full h-full flex flex-col">
        {/* Main spotlight view */}
        <div className="flex-1 relative">
          <ParticipantTile
            participant={spotlightParticipant}
            stream={remoteStreams.get(spotlightParticipant.user_id)}
            callType={callType}
            isSpotlight
          />
        </div>
        
        {/* Other participants strip */}
        <div className="h-24 bg-background/50 flex items-center gap-2 px-4 overflow-x-auto">
          {allParticipants.filter(p => !p.is_spotlight).map(participant => (
            <ParticipantThumbnail
              key={participant.id}
              participant={participant}
              stream={remoteStreams.get(participant.user_id)}
              callType={callType}
              isSmall
            />
          ))}
        </div>
      </div>
    );
  }

  // Standard grid view
  // For 1-on-1 calls, skip grid padding so the remote video fills the entire screen
  const isSingleRemote = allParticipants.length === 1;

  return (
    <div className={cn(
      "w-full h-full grid",
      isSingleRemote ? "grid-cols-1" : cn("gap-1 p-2", getGridClass())
    )}>
      {/* Remote participants (from DB + stream-only) */}
      {allParticipants.map(participant => (
        <ParticipantTile
          key={participant.id}
          participant={participant}
          stream={remoteStreams.get(participant.user_id)}
          callType={callType}
        />
      ))}
      
      {/* Local user (if only one, show full screen) */}
      {allParticipants.length === 0 && localStream && callType === 'video' && (
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
}

function ParticipantTile({ participant, stream, callType, isSpotlight }: ParticipantTileProps) {
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

interface ParticipantThumbnailProps {
  participant: Participant;
  stream?: MediaStream;
  callType: 'voice' | 'video';
  isSmall?: boolean;
}

function ParticipantThumbnail({ participant, stream, callType, isSmall }: ParticipantThumbnailProps) {
  // Check if stream has active video track - don't rely only on database state
  const hasVideoTrack = stream?.getVideoTracks().some(track => track.enabled && track.readyState === 'live');
  const showVideo = !!stream && !!hasVideoTrack;
  const hasStream = !!stream;

  return (
    <div className="relative w-20 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
      {/* Always render video/audio element if we have a stream */}
      {hasStream && <CallRemoteMedia stream={stream!} showVideo={showVideo} />}
      
      {!showVideo && (
        <div className="w-full h-full flex items-center justify-center">
          <Avatar className="h-10 w-10">
            <AvatarImage src={participant.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {participant.display_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {participant.is_muted && (
        <div className="absolute bottom-1 right-1 p-0.5 rounded-full bg-red-500">
          <MicOff className="h-2 w-2 text-white" />
        </div>
      )}
    </div>
  );
}
