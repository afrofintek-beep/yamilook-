import { useRef, useState } from 'react';
import { useWebRTC } from './useWebRTC';
import { useLiveKitCall } from './useLiveKitCall';
import { supabase } from '@/integrations/supabase/client';

/** New direct calls use LiveKit; existing/legacy and group calls retain their
 * original transport. Both hooks remain idle until explicitly selected. */
export function useCallTransport() {
  const legacy = useWebRTC();
  const livekit = useLiveKitCall();
  const [selected, setSelected] = useState<'livekit' | 'webrtc'>('livekit');
  const pending = useRef(false);
  const operation = useRef(0);
  const active = selected === 'livekit' ? livekit : legacy;
  const assertAvailable = () => {
    if (pending.current || legacy.state.callId || livekit.state.callId) throw new Error('Já existe uma chamada em curso.');
  };
  return {
    ...active,
    initiateCall: async (target: string, type: 'voice' | 'video', conversationId?: string) => {
      assertAvailable(); const epoch = ++operation.current; pending.current = true; setSelected('livekit');
      try { return await livekit.initiateCall(target, type, conversationId); }
      finally { if (operation.current === epoch) pending.current = false; }
    },
    answerCall: async (id: string, type: 'voice' | 'video', target: string) => {
      assertAvailable(); const epoch = ++operation.current; pending.current = true;
      try {
        const { data, error } = await supabase.from('calls').select('sdp_offer, is_group_call').eq('id', id).single();
        if (epoch !== operation.current) throw new Error('Chamada cancelada.');
        if (error || !data) throw new Error('Não foi possível verificar a chamada.');
        const offer = data.sdp_offer;
        const isLiveKit = !data.is_group_call && offer && typeof offer === 'object' && !Array.isArray(offer) && offer.transport === 'livekit-v1';
        setSelected(isLiveKit ? 'livekit' : 'webrtc');
        await (isLiveKit ? livekit : legacy).answerCall(id, type, target);
      } finally { if (operation.current === epoch) pending.current = false; }
    },
    endCall: async () => {
      operation.current++; pending.current = false;
      await Promise.all([legacy.endCall(), livekit.endCall()]);
    },
    markUserInteracted: () => { legacy.markUserInteracted(); livekit.markUserInteracted(); },
    // Declining needs only the authoritative call row, not a media session.
    declineCall: livekit.declineCall,
  };
}
