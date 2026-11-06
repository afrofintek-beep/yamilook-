import { useEffect, useRef, useState } from 'react';
import { useWebRTC } from './useWebRTC';
import { useLiveKitCall } from './useLiveKitCall';
import { supabase } from '@/integrations/supabase/client';
import { hasActiveCall, holdCallUpdates } from '@/lib/call-update-guard';

/** New direct calls use LiveKit; existing/legacy and group calls retain their
 * original transport. Both hooks remain idle until explicitly selected. */
export function useCallTransport() {
  const legacy = useWebRTC();
  const livekit = useLiveKitCall();
  const [selected, setSelected] = useState<'livekit' | 'webrtc'>('livekit');
  const pending = useRef(false);
  const operation = useRef(0);
  const updateHold = useRef<(() => void) | null>(null);
  const protect = () => { updateHold.current ??= holdCallUpdates(); };
  const unprotect = () => { updateHold.current?.(); updateHold.current = null; };
  const active = selected === 'livekit' ? livekit : legacy;
  useEffect(() => {
    if (!pending.current && ['idle','ended','declined','failed'].includes(active.state.callStatus)) {
      updateHold.current?.(); updateHold.current = null;
    }
  }, [active.state.callStatus]);
  useEffect(() => () => { updateHold.current?.(); updateHold.current = null; }, []);
  const assertAvailable = () => {
    if (pending.current || legacy.state.callId || livekit.state.callId || (hasActiveCall() && !updateHold.current)) throw new Error('Já existe uma chamada em curso.');
  };
  const connectIncoming = async (id: string, type: 'voice' | 'video', target: string, epoch: number) => {
    const { data, error } = await supabase.from('calls').select('sdp_offer, is_group_call').eq('id', id).single();
    if (epoch !== operation.current) throw new Error('Chamada cancelada.');
    if (error || !data) throw new Error('Não foi possível verificar a chamada.');
    const offer = data.sdp_offer;
    const isLiveKit = !data.is_group_call && offer && typeof offer === 'object' && !Array.isArray(offer) && offer.transport === 'livekit-v1';
    setSelected(isLiveKit ? 'livekit' : 'webrtc');
    await (isLiveKit ? livekit : legacy).answerCall(id, type, target);
  };
  return {
    ...active,
    initiateCall: async (target: string, type: 'voice' | 'video', conversationId?: string) => {
      assertAvailable(); protect(); const epoch = ++operation.current; pending.current = true; setSelected('livekit');
      try { return await livekit.initiateCall(target, type, conversationId); }
      catch (error) { if (operation.current === epoch) unprotect(); throw error; }
      finally { if (operation.current === epoch) pending.current = false; }
    },
    answerCall: async (id: string, type: 'voice' | 'video', target: string) => {
      assertAvailable(); protect(); const epoch = ++operation.current; pending.current = true;
      try {
        await connectIncoming(id, type, target, epoch);
      } catch (error) { if (operation.current === epoch) unprotect(); throw error; }
      finally { if (operation.current === epoch) pending.current = false; }
    },
    endAndAnswerCall: async (currentId: string, id: string, type: 'voice' | 'video', target: string) => {
      if (pending.current || active.state.callId !== currentId || currentId === id) throw new Error('A chamada atual mudou. Tenta novamente.');
      protect(); const epoch = ++operation.current; pending.current = true;
      let released = false;
      try {
        // Verify the invitation and end only the user's specified call atomically.
        // A stale/cancelled invitation must leave the current conversation intact.
        const { data, error } = await supabase.rpc('end_direct_call_for_waiting', { p_current_call_id: currentId, p_waiting_call_id: id });
        if (epoch !== operation.current) throw new Error('Chamada cancelada.');
        if (error || !data) throw new Error('A chamada em espera já terminou ou foi atendida noutro dispositivo.');
        // Release all old microphone/camera/screen tracks before connecting the new peer.
        released = true;
        await Promise.all([legacy.endCall(), livekit.endCall()]);
        if (epoch !== operation.current) throw new Error('Chamada cancelada.');
        await connectIncoming(id, type, target, epoch);
      } catch (error) {
        if (released && epoch === operation.current) unprotect();
        throw error;
      } finally {
        if (operation.current === epoch) pending.current = false;
      }
    },
    endCall: async () => {
      operation.current++; pending.current = false;
      await Promise.all([legacy.endCall(), livekit.endCall()]);
      unprotect();
    },
    markUserInteracted: () => { legacy.markUserInteracted(); livekit.markUserInteracted(); },
    // Declining needs only the authoritative call row, not a media session.
    declineCall: async (id: string, target: string) => {
      const { data, error } = await supabase.from('calls').select('is_group_call').eq('id', id).single();
      if (error || !data) throw new Error('Não foi possível verificar a chamada.');
      await (data.is_group_call ? legacy : livekit).declineCall(id, target);
    },
  };
}
