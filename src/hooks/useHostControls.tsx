import { uiText } from '@/i18n/ui-copy';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface BreakoutRoom {
  id: string;
  name: string;
  is_active: boolean;
  participants: Array<{
    id: string;
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  }>;
}

export function useHostControls(callId: string) {
  const { user } = useAuth();

  // Check if current user is host/co-host
  const checkIsHost = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    const { data } = await supabase
      .from('call_participants')
      .select('role')
      .eq('call_id', callId)
      .eq('user_id', user.id)
      .single();

    return data?.role === 'host' || data?.role === 'co_host';
  }, [callId, user]);

  // Mute all participants
  const muteAllParticipants = useCallback(async () => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can mute all participants"));
      return;
    }

    const { error } = await supabase
      .from('call_participants')
      .update({ is_muted: true })
      .eq('call_id', callId)
      .neq('user_id', user?.id);

    if (error) {
      toast.error(uiText("Failed to mute participants"));
    } else {
      toast.success(uiText("All participants muted"));
    }
  }, [callId, user, checkIsHost]);

  // Remove participant from call
  const removeParticipant = useCallback(async (participantUserId: string) => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can remove participants"));
      return;
    }

    const { error } = await supabase
      .from('call_participants')
      .update({ status: 'removed' })
      .eq('call_id', callId)
      .eq('user_id', participantUserId);

    if (error) {
      toast.error(uiText("Failed to remove participant"));
    } else {
      toast.success(uiText("Participant removed"));
    }
  }, [callId, checkIsHost]);

  // Make participant co-host
  const makeCoHost = useCallback(async (participantUserId: string) => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can promote participants"));
      return;
    }

    const { error } = await supabase
      .from('call_participants')
      .update({ role: 'co_host' })
      .eq('call_id', callId)
      .eq('user_id', participantUserId);

    if (error) {
      toast.error(uiText("Failed to promote participant"));
    } else {
      toast.success(uiText("Participant promoted to co-host"));
    }
  }, [callId, checkIsHost]);

  // Spotlight participant
  const spotlightParticipant = useCallback(async (participantUserId: string, spotlight: boolean) => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can spotlight participants"));
      return;
    }

    // Remove spotlight from others first
    if (spotlight) {
      await supabase
        .from('call_participants')
        .update({ is_spotlight: false })
        .eq('call_id', callId);
    }

    const { error } = await supabase
      .from('call_participants')
      .update({ is_spotlight: spotlight })
      .eq('call_id', callId)
      .eq('user_id', participantUserId);

    if (error) {
      toast.error(uiText("Failed to spotlight participant"));
    }
  }, [callId, checkIsHost]);

  // Lock/unlock call
  const toggleCallLock = useCallback(async (locked: boolean) => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can lock/unlock the call"));
      return;
    }

    const { error } = await supabase
      .from('calls')
      .update({ is_locked: locked })
      .eq('id', callId);

    if (error) {
      toast.error(uiText("Failed to update call lock status"));
    } else {
      toast.success(locked ? 'Call locked' : 'Call unlocked');
    }
  }, [callId, checkIsHost]);

  // Toggle waiting room
  const toggleWaitingRoom = useCallback(async (enabled: boolean) => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can toggle waiting room"));
      return;
    }

    const { error } = await supabase
      .from('calls')
      .update({ waiting_room_enabled: enabled })
      .eq('id', callId);

    if (error) {
      toast.error(uiText("Failed to toggle waiting room"));
    } else {
      toast.success(enabled ? 'Waiting room enabled' : 'Waiting room disabled');
    }
  }, [callId, checkIsHost]);

  // Admit participant from waiting room
  const admitParticipant = useCallback(async (participantUserId: string) => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can admit participants"));
      return;
    }

    const { error } = await supabase
      .from('call_participants')
      .update({ status: 'connected', joined_at: new Date().toISOString() })
      .eq('call_id', callId)
      .eq('user_id', participantUserId);

    if (error) {
      toast.error(uiText("Failed to admit participant"));
    } else {
      toast.success(uiText("Participant admitted"));
    }
  }, [callId, checkIsHost]);

  // Admit all from waiting room
  const admitAllParticipants = useCallback(async () => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can admit participants"));
      return;
    }

    const { error } = await supabase
      .from('call_participants')
      .update({ status: 'connected', joined_at: new Date().toISOString() })
      .eq('call_id', callId)
      .eq('status', 'waiting');

    if (error) {
      toast.error(uiText("Failed to admit participants"));
    } else {
      toast.success(uiText("All participants admitted"));
    }
  }, [callId, checkIsHost]);

  // Lower all hands
  const lowerAllHands = useCallback(async () => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can lower all hands"));
      return;
    }

    const { error } = await supabase
      .from('call_participants')
      .update({ is_hand_raised: false })
      .eq('call_id', callId);

    if (error) {
      toast.error(uiText("Failed to lower hands"));
    } else {
      toast.success(uiText("All hands lowered"));
    }
  }, [callId, checkIsHost]);

  // Create breakout room
  const createBreakoutRoom = useCallback(async (name: string) => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can create breakout rooms"));
      return null;
    }

    const { data, error } = await supabase
      .from('breakout_rooms')
      .insert({
        call_id: callId,
        name,
      })
      .select()
      .single();

    if (error) {
      toast.error(uiText("Failed to create breakout room"));
      return null;
    }

    toast.success(`Breakout room "${name}" created`);
    return data;
  }, [callId, checkIsHost]);

  // Close breakout room
  const closeBreakoutRoom = useCallback(async (roomId: string) => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can close breakout rooms"));
      return;
    }

    const { error } = await supabase
      .from('breakout_rooms')
      .update({ is_active: false })
      .eq('id', roomId);

    if (error) {
      toast.error(uiText("Failed to close breakout room"));
    } else {
      toast.success(uiText("Breakout room closed"));
    }
  }, [checkIsHost]);

  // Assign participant to breakout room
  const assignToBreakoutRoom = useCallback(async (roomId: string, participantUserId: string) => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can assign participants"));
      return;
    }

    // Remove from other breakout rooms first
    await supabase
      .from('breakout_room_participants')
      .delete()
      .eq('user_id', participantUserId);

    const { error } = await supabase
      .from('breakout_room_participants')
      .insert({
        breakout_room_id: roomId,
        user_id: participantUserId,
      });

    if (error) {
      toast.error(uiText("Failed to assign participant"));
    } else {
      toast.success(uiText("Participant assigned to breakout room"));
    }
  }, [checkIsHost]);

  // Move participant back to main room
  const moveToMainRoom = useCallback(async (participantUserId: string) => {
    const { error } = await supabase
      .from('breakout_room_participants')
      .delete()
      .eq('user_id', participantUserId);

    if (error) {
      toast.error(uiText("Failed to move participant"));
    }
  }, []);

  // Fetch breakout rooms
  const fetchBreakoutRooms = useCallback(async (): Promise<BreakoutRoom[]> => {
    const { data: rooms, error } = await supabase
      .from('breakout_rooms')
      .select('id, name, is_active')
      .eq('call_id', callId)
      .eq('is_active', true);

    if (error || !rooms) return [];

    const roomsWithParticipants = await Promise.all(
      rooms.map(async (room) => {
        const { data: participants } = await supabase
          .from('breakout_room_participants')
          .select('id, user_id')
          .eq('breakout_room_id', room.id);

        const participantDetails = await Promise.all(
          (participants || []).map(async (p) => {
            const { data: profile } = await supabase
              .from('public_profiles')
              .select('display_name, avatar_url')
              .eq('id', p.user_id)
              .single();

            return {
              id: p.id,
              user_id: p.user_id,
              display_name: profile?.display_name || 'Unknown',
              avatar_url: profile?.avatar_url || null,
            };
          })
        );

        return {
          ...room,
          participants: participantDetails,
        };
      })
    );

    return roomsWithParticipants;
  }, [callId]);

  // Close all breakout rooms
  const closeAllBreakoutRooms = useCallback(async () => {
    const isHost = await checkIsHost();
    if (!isHost) {
      toast.error(uiText("Only hosts can close breakout rooms"));
      return;
    }

    const { error } = await supabase
      .from('breakout_rooms')
      .update({ is_active: false })
      .eq('call_id', callId);

    if (error) {
      toast.error(uiText("Failed to close breakout rooms"));
    } else {
      toast.success(uiText("All breakout rooms closed"));
    }
  }, [callId, checkIsHost]);

  return {
    checkIsHost,
    muteAllParticipants,
    removeParticipant,
    makeCoHost,
    spotlightParticipant,
    toggleCallLock,
    toggleWaitingRoom,
    admitParticipant,
    admitAllParticipants,
    lowerAllHands,
    createBreakoutRoom,
    closeBreakoutRoom,
    assignToBreakoutRoom,
    moveToMainRoom,
    fetchBreakoutRooms,
    closeAllBreakoutRooms,
  };
}
