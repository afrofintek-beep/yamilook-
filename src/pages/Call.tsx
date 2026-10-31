import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VideoCall } from '@/components/calls/VideoCall';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useActiveCallRequired } from '@/components/calls/ActiveCallProvider';

interface CallInfo {
  id: string;
  type: 'voice' | 'video';
  initiator_id: string;
  is_group_call: boolean;
  conversation_id: string | null;
}

interface ParticipantInfo {
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

export default function Call() {
  const { callId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinCall } = useActiveCallRequired();
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const autoJoinAttemptedRef = useRef(false);

  useEffect(() => {
    autoJoinAttemptedRef.current = false;
  }, [callId]);

  useEffect(() => {
    const fetchCallInfo = async () => {
      if (!callId) return;

      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (error || !data) {
        console.error('Error fetching call:', error);
        navigate('/calls');
        return;
      }

      // If the call has already ended/declined, redirect immediately
      if (data.status === 'ended' || data.status === 'declined' || data.status === 'failed') {
        console.log('[Call] Call already ended/declined, redirecting to /calls');
        navigate('/calls');
        return;
      }

      setCallInfo({
        id: data.id,
        type: data.type as 'voice' | 'video',
        initiator_id: data.initiator_id,
        is_group_call: data.is_group_call,
        conversation_id: data.conversation_id,
      });

      // Fetch participants
      const { data: participantsData } = await supabase
        .from('call_participants')
        .select('id, user_id, is_muted, is_video_enabled, is_screen_sharing, is_hand_raised, is_spotlight')
        .eq('call_id', callId);

      if (participantsData && participantsData.length > 0) {
        const otherParticipants = user?.id
          ? participantsData.filter((p) => p.user_id !== user.id)
          : participantsData;
        // A callee may only see their own participant row under RLS. The call
        // row already identifies both invited parties; do not wait for a stream
        // to invent an anonymous/Connecting participant.
        const knownIds = [data.initiator_id, data.caller_id, data.callee_id]
          .filter((id): id is string => !!id && id !== user?.id);
        for (const id of new Set(knownIds)) {
          if (!otherParticipants.some(p => p.user_id === id)) otherParticipants.push({
            id: `invited-${id}`, user_id: id, is_muted: false,
            is_video_enabled: data.type === 'video', is_screen_sharing: false,
            is_hand_raised: false, is_spotlight: false,
          });
        }

        // Fetch profiles separately
        const userIds = otherParticipants.map(p => p.user_id);
        const { data: profiles } = await supabase
          .rpc('get_public_profiles_by_ids', { p_ids: userIds });

        const participantsWithProfiles = otherParticipants.map((p) => {
          const profile = profiles?.find(prof => prof.id === p.user_id);
          return {
            id: p.id,
            user_id: p.user_id,
            display_name: profile?.display_name || 'Participante',
            avatar_url: profile?.avatar_url || null,
            is_muted: p.is_muted,
            is_video_enabled: p.is_video_enabled,
            is_screen_sharing: p.is_screen_sharing,
            is_hand_raised: p.is_hand_raised,
            is_spotlight: p.is_spotlight,
          };
        });
        setParticipants(participantsWithProfiles);
      }

      setLoading(false);
    };

    fetchCallInfo();

    // Subscribe to participant changes AND call status changes
    const channel = supabase
      .channel(`call-room-${callId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_participants',
          filter: `call_id=eq.${callId}`,
        },
        () => { fetchCallInfo(); }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          const newStatus = (payload.new as Partial<Tables<'calls'>>)?.status;
          if (newStatus === 'ended' || newStatus === 'declined' || newStatus === 'failed') {
            console.log('[Call] Call status changed to', newStatus, '- redirecting');
            navigate('/calls');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, navigate, user?.id]);

  // Auto-join when landing on /call/:id as a non-initiator (deep link / scheduled join)
  useEffect(() => {
    if (!callInfo || !user?.id) return;
    if (autoJoinAttemptedRef.current) return;

    // Initiator already bootstraps the call via startCall(); joining would incorrectly try to connect to self.
    if (callInfo.initiator_id === user.id) return;

    autoJoinAttemptedRef.current = true;
    void joinCall(callInfo.id, callInfo.type, callInfo.initiator_id);
  }, [callInfo, joinCall, user?.id]);

  const handleEndCall = () => {
    navigate('/calls');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!callInfo) {
    return null;
  }

  return (
    <VideoCall
      conversationId={callInfo.conversation_id}
      callId={callInfo.id}
      callType={callInfo.type}
      isGroupCall={callInfo.is_group_call}
      participants={participants}
      onEndCall={handleEndCall}
    />
  );
}
