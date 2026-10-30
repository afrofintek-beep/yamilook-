import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room, Participant } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCallLifecycle } from './webrtc/useCallLifecycle';
import { watchCallTermination } from './webrtc/call-termination';
import { INITIAL_STATE, type CallState } from './webrtc/types';
import { VirtualBackgroundProcessor, DEFAULT_EFFECTS, effectsActive, type BgMode, type EffectsConfig } from '@/lib/virtualBackground';
import { registerCallMedia } from '@/lib/call-media';
import { callOutcomeMessage } from '@/lib/call-feedback';
import { callSetupFailure } from '@/lib/call-setup-failure';
import { toast } from '@/hooks/use-toast';

/** LiveKit owns transport, ICE/TURN, congestion control and reconnection.
 * The existing authenticated call rows still own invitations, history and hangup.
 * A room connection alone is never reported as a connected two-person call.
 */
export function useLiveKitCall() {
  const { user, profile } = useAuth();
  const [state, setState] = useState<CallState>({ ...INITIAL_STATE });
  const roomRef = useRef<Room | null>(null);
  const sdkRef = useRef<typeof import('livekit-client')>();
  const callRef = useRef<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const microphoneRef = useRef<MediaStreamTrack | null>(null);
  const setupStage = useRef('microphone');
  const deadline = useRef<ReturnType<typeof setTimeout>>();
  const peerDeadline = useRef<ReturnType<typeof setTimeout>>();
  const processor = useRef<VirtualBackgroundProcessor | null>(null);
  const rawCamera = useRef<MediaStreamTrack | null>(null);
  const effects = useRef<EffectsConfig>({ ...DEFAULT_EFFECTS });
  const lifecycle = useCallLifecycle({
    onCallStarted: () => {}, onCallEnded: () => releaseRef.current(),
    onCallFailed: () => releaseRef.current(), onRingTimeout: () => {},
  });
  const lifecycleRef = useRef(lifecycle);
  lifecycleRef.current = lifecycle;
  const releaseRef = useRef<() => void>(() => {});

  const release = useCallback(() => {
    generation.current++;
    callRef.current = null;
    busy.current = false;
    clearTimeout(deadline.current);
    clearTimeout(peerDeadline.current);
    lifecycleRef.current.clearRingTimeout();
    processor.current?.stop();
    processor.current = null;
    rawCamera.current?.stop();
    rawCamera.current = null;
    microphoneRef.current?.stop();
    microphoneRef.current = null;
    effects.current = { ...DEFAULT_EFFECTS };
    const room = roomRef.current;
    roomRef.current = null;
    // Stop hardware synchronously, even if disconnect/network never completes.
    room?.localParticipant.trackPublications.forEach(p => p.track?.stop());
    room?.removeAllListeners();
    void room?.disconnect();
    setState({ ...INITIAL_STATE, remoteStreams: new Map(), callStatus: 'ended' });
  }, []);
  releaseRef.current = release;

  const fail = useCallback((message: string, reason = 'transport_failed') => {
    const id = callRef.current;
    release();
    setState(s => ({ ...s, callStatus: 'failed', lastError: message }));
    if (id) void supabase.from('calls').update({ status: 'failed', ended_at: new Date().toISOString(), end_reason: reason })
      .eq('id', id).in('status', ['ringing', 'connecting', 'ongoing']).then(({ error }) => {
        if (error) console.error('[LiveKitCall] Persist failure:', error.message);
      });
  }, [release]);

  const prepareMicrophone = useCallback(async (epoch: number) => {
    setupStage.current = 'microphone';
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
    });
    if (generation.current !== epoch) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('Chamada cancelada.');
    }
    const microphone = stream.getAudioTracks()[0];
    if (!microphone) {
      stream.getTracks().forEach(track => track.stop());
      throw new DOMException('Microfone indisponível.', 'NotFoundError');
    }
    microphoneRef.current = microphone;
  }, []);

  const refresh = useCallback((room: Room) => {
    if (roomRef.current !== room) return;
    const { Track, ConnectionState } = sdkRef.current!;
    const streamFor = (p: Participant) => new MediaStream([...p.trackPublications.values()]
      .filter(pub => pub.track && !pub.isMuted).map(pub => pub.track!.mediaStreamTrack));
    const remote = new Map<string, MediaStream>();
    room.remoteParticipants.forEach(p => {
      const stream = streamFor(p);
      registerCallMedia(stream, [...p.trackPublications.values()].filter(pub => pub.track && !pub.isMuted).map(pub => pub.track!));
      remote.set(p.identity, stream);
    });
    const local = room.localParticipant;
    setState(s => ({ ...s, localStream: streamFor(local), remoteStreams: remote,
      isMuted: !local.isMicrophoneEnabled, isVideoEnabled: local.isCameraEnabled,
      isScreenSharing: local.isScreenShareEnabled,
      screenStream: local.getTrackPublication(Track.Source.ScreenShare)?.track
        ? new MediaStream([local.getTrackPublication(Track.Source.ScreenShare)!.track!.mediaStreamTrack]) : null,
    }));
    const peerHasMedia = [...room.remoteParticipants.values()].some(p =>
      [...p.trackPublications.values()].some(pub => pub.isSubscribed && pub.track));
    if (peerHasMedia && room.state === ConnectionState.Connected) {
      clearTimeout(deadline.current);
      clearTimeout(peerDeadline.current);
      lifecycleRef.current.clearRingTimeout();
      setState(s => ({ ...s, callStatus: 'connected', connectionState: 'connected', lastError: null }));
    }
  }, []);

  const connect = useCallback(async (id: string, type: 'voice' | 'video', target: string, initiator: boolean, epoch: number) => {
    setupStage.current = 'token';
    const { data, error } = await supabase.functions.invoke('generate-livekit-token', {
      body: { roomName: `call-${id}`, participantName: profile?.display_name || 'Utilizador', participantIdentity: user!.id },
    });
    if (generation.current !== epoch) throw new Error('Chamada cancelada.');
    if (error || !data?.token || !data?.url) throw new Error('Não foi possível obter acesso seguro à chamada.');
    setupStage.current = 'sdk';
    const sdk = await import('livekit-client');
    if (generation.current !== epoch) throw new Error('Chamada cancelada.');
    sdkRef.current = sdk;
    const { Room, RoomEvent } = sdk;
    const room = new Room({ adaptiveStream: true, dynacast: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      videoCaptureDefaults: { resolution: { width: 640, height: 360, frameRate: 24 }, facingMode: 'user' },
      publishDefaults: { simulcast: true, dtx: true, red: true },
    });
    roomRef.current = room;
    const sync = () => refresh(room);
    room.on(RoomEvent.TrackSubscribed, sync).on(RoomEvent.TrackUnsubscribed, sync)
      .on(RoomEvent.TrackMuted, sync).on(RoomEvent.TrackUnmuted, sync)
      .on(RoomEvent.LocalTrackPublished, sync).on(RoomEvent.LocalTrackUnpublished, sync)
      .on(RoomEvent.ParticipantConnected, sync)
      .on(RoomEvent.ParticipantDisconnected, () => {
        sync();
        if (room.remoteParticipants.size === 0) {
          setState(s => ({ ...s, callStatus: 'connecting', connectionState: 'disconnected', lastError: 'A aguardar o regresso do outro participante…' }));
          clearTimeout(peerDeadline.current);
          peerDeadline.current = setTimeout(() => { if (roomRef.current === room && room.remoteParticipants.size === 0) fail('O outro participante perdeu a ligação.'); }, 45_000);
        }
      })
      .on(RoomEvent.Reconnecting, () => {
        setState(s => ({ ...s, callStatus: 'connecting', connectionState: 'disconnected', lastError: 'A restabelecer a ligação…' }));
      })
      .on(RoomEvent.Reconnected, sync)
      .on(RoomEvent.Disconnected, () => { if (roomRef.current === room) fail('A ligação foi interrompida. Tenta novamente.'); });
    setState(s => ({ ...s, callId: id, callType: type, targetUserId: target, isInitiator: initiator,
      callStatus: initiator ? 'ringing' : 'connecting', connectionState: 'connecting', lastError: null }));
    deadline.current = setTimeout(async () => {
      if (roomRef.current !== room) return;
      if (!initiator) { fail('Não foi possível estabelecer a chamada.'); return; }
      const { data: ended, error: timeoutError } = await supabase.rpc('finish_direct_call', { p_call_id: id, p_outcome: 'no_answer' });
      if (roomRef.current !== room) return;
      if (timeoutError) { fail('Não foi possível confirmar a resposta. Tenta novamente.'); return; }
      if (ended) { releaseRef.current(); setState(s => ({ ...s, lastError: 'Sem resposta.' })); }
    }, 60_000);
    setupStage.current = 'room_connect';
    await room.connect(data.url, data.token);
    if (roomRef.current !== room || generation.current !== epoch) { await room.disconnect(); throw new Error('Chamada cancelada.'); }
    setupStage.current = 'microphone_publish';
    const microphone = microphoneRef.current;
    if (!microphone || microphone.readyState === 'ended') throw new DOMException('Microfone indisponível.', 'NotReadableError');
    // Publish the already authorised track; do not capture a second microphone.
    await room.localParticipant.publishTrack(microphone, { source: sdk.Track.Source.Microphone });
    if (type === 'video') {
      setupStage.current = 'camera';
      try { await room.localParticipant.setCameraEnabled(true); }
      catch { toast({ title: 'Câmara indisponível', description: 'A chamada continua por voz. Podes voltar a ligar a câmara.' }); }
    }
    if (roomRef.current !== room || generation.current !== epoch) { room.localParticipant.trackPublications.forEach(p => p.track?.stop()); await room.disconnect(); throw new Error('Chamada cancelada.'); }
    refresh(room);
  }, [user, profile?.display_name, refresh, fail]);

  const initiateCall = useCallback(async (target: string, type: 'voice' | 'video', conversationId?: string) => {
    if (!user || !target || target === user.id) throw new Error('Selecciona outro contacto para iniciar a chamada.');
    if (busy.current || roomRef.current) throw new Error('Já existe uma chamada em curso.');
    busy.current = true;
    const epoch = ++generation.current;
    let id: string | null = null;
    setState(s => ({ ...s, callStatus: 'initiating', isInitiator: true, callType: type, targetUserId: target, lastError: null }));
    try {
      // Nothing is announced to the recipient while the caller is deciding on permission.
      await prepareMicrophone(epoch);
      setupStage.current = 'create';
      id = await lifecycleRef.current.createCallInDB(target, type, conversationId, 'livekit');
      if (generation.current !== epoch) {
        await supabase.rpc('finish_direct_call', { p_call_id: id, p_outcome: 'cancelled' });
        throw new Error('Chamada cancelada.');
      }
      callRef.current = id;
      await connect(id, type, target, true, epoch);
      return id;
    } catch (e) {
      if (generation.current === epoch) { const failure = callSetupFailure(setupStage.current, e); fail(failure.message, failure.reason); }
      throw e;
    } finally { if (generation.current === epoch) busy.current = false; }
  }, [user, connect, fail, prepareMicrophone]);

  const answerCall = useCallback(async (id: string, type: 'voice' | 'video', target: string) => {
    if (!user) throw new Error('Inicia sessão.');
    if (busy.current || roomRef.current) throw new Error('Já existe uma chamada em curso.');
    busy.current = true;
    const epoch = ++generation.current;
    try {
      setupStage.current = 'claim';
      const { data: claimed, error: claimError } = await supabase.rpc('claim_direct_call', { p_call_id: id });
      if (generation.current !== epoch) {
        if (claimed) await supabase.rpc('finish_direct_call', { p_call_id: id, p_outcome: 'completed' });
        return;
      }
      if (claimError || !claimed) throw new Error('A chamada já terminou ou foi atendida noutro dispositivo.');
      callRef.current = id;
      await prepareMicrophone(epoch);
      await connect(id, type, target, false, epoch);
      if (generation.current !== epoch) return;
      setupStage.current = 'accept';
      // Only persist acceptance after the transport and local microphone are ready.
      const { data: accepted, error: acceptError } = await supabase.from('calls')
        .update({ status: 'ongoing', started_at: new Date().toISOString() })
        .eq('id', id).eq('status', 'connecting').select('id').maybeSingle();
      if (acceptError || !accepted) throw new Error('A chamada já terminou ou não pode ser atendida.');
      if (generation.current !== epoch) return;
      const { data: joined, error: joinError } = await supabase.from('call_participants')
        .update({ status: 'connected', joined_at: new Date().toISOString() })
        .eq('call_id', id).eq('user_id', user.id).in('status', ['ringing', 'connected']).select('id').maybeSingle();
      if (joinError || !joined) throw new Error('Não foi possível confirmar a participação na chamada.');
    } catch (e) {
      if (generation.current === epoch) { const failure = callSetupFailure(setupStage.current, e); fail(failure.message, failure.reason); }
      throw e;
    } finally { if (generation.current === epoch) busy.current = false; }
  }, [user, connect, fail, prepareMicrophone]);

  const endCall = useCallback(async () => {
    const id = callRef.current;
    release();
    if (id && user) {
      try { const { error } = await supabase.rpc('finish_direct_call', { p_call_id: id, p_outcome: 'completed' }); if (error) throw error; }
      catch { toast({ title: 'Chamada terminada neste dispositivo', description: 'Não foi possível confirmar o encerramento remoto.', variant: 'destructive' }); }
    }
  }, [release, user]);

  useEffect(() => {
    if (!state.callId) return;
    const id = state.callId;
    return watchCallTermination({
      read: async () => { const { data, error } = await supabase.from('calls').select('status,end_reason').eq('id', id).maybeSingle(); if (error) throw error; return data || null; },
      subscribe: listener => {
        const ch = supabase.channel(`livekit-call-${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${id}` }, p => listener({ status: String(p.new.status), end_reason: typeof p.new.end_reason === 'string' ? p.new.end_reason : null })).subscribe();
        return () => { void supabase.removeChannel(ch); };
      },
      onEnded: outcome => { if (callRef.current === id) { release(); setState(s => ({ ...s, callStatus: outcome.status === 'declined' || outcome.end_reason === 'declined' ? 'declined' : 'ended', lastError: callOutcomeMessage(outcome.status, outcome.end_reason) })); } },
    });
  }, [state.callId, release]);
  useEffect(() => () => releaseRef.current(), [user?.id]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current; if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled); refresh(room);
      if (callRef.current && user) await lifecycleRef.current.updateMediaStatus(callRef.current, user.id, !room.localParticipant.isMicrophoneEnabled);
    }
    catch { toast({ title: 'Não foi possível alterar o microfone', variant: 'destructive' }); }
  }, [refresh, user]);
  const toggleVideo = useCallback(async () => {
    const room = roomRef.current; if (!room) return;
    try {
      const track = room.localParticipant.getTrackPublication(sdkRef.current!.Track.Source.Camera)?.videoTrack;
      if (track && rawCamera.current) await track.replaceTrack(rawCamera.current, true);
      processor.current?.stop(); processor.current = null; rawCamera.current = null;
      effects.current = { ...DEFAULT_EFFECTS };
      await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled); refresh(room);
      if (callRef.current && user) await lifecycleRef.current.updateMediaStatus(callRef.current, user.id, undefined, room.localParticipant.isCameraEnabled);
    }
    catch { toast({ title: 'Não foi possível alterar a câmara', variant: 'destructive' }); }
  }, [refresh, user]);
  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current; if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled); refresh(room);
      if (callRef.current && user) await lifecycleRef.current.updateMediaStatus(callRef.current, user.id, undefined, undefined, room.localParticipant.isScreenShareEnabled);
    }
    catch { toast({ title: 'Partilha de ecrã indisponível', variant: 'destructive' }); }
  }, [refresh, user]);
  const flipCamera = useCallback(async () => {
    const room = roomRef.current;
    const track = room?.localParticipant.getTrackPublication(sdkRef.current!.Track.Source.Camera)?.videoTrack;
    if (!room || !track) return;
    if (rawCamera.current) await track.replaceTrack(rawCamera.current, true);
    processor.current?.stop(); processor.current = null;
    effects.current = { ...DEFAULT_EFFECTS };
    const facing = track.mediaStreamTrack.getSettings().facingMode;
    await track.restartTrack({ facingMode: facing === 'environment' ? 'user' : 'environment' });
    rawCamera.current = null;
    refresh(room);
  }, [refresh]);
  const applyEffects = useCallback(async (partial: Partial<EffectsConfig>) => {
    const room = roomRef.current;
    const track = room?.localParticipant.getTrackPublication(sdkRef.current!.Track.Source.Camera)?.videoTrack;
    if (!room || !track) return;
    effects.current = { ...effects.current, ...partial };
    rawCamera.current ||= track.mediaStreamTrack;
    const epoch = generation.current;
    const previous = processor.current;
    try {
      if (effectsActive(effects.current)) {
        const next = await VirtualBackgroundProcessor.create(rawCamera.current, effects.current);
        if (generation.current !== epoch || roomRef.current !== room) { next.stop(); return; }
        await track.replaceTrack(next.outputStream.getVideoTracks()[0], true);
        processor.current = next;
      } else { await track.replaceTrack(rawCamera.current, true); processor.current = null; }
      previous?.stop();
      refresh(room);
    } catch {
      if (generation.current !== epoch || !rawCamera.current) return;
      await track.replaceTrack(rawCamera.current, true);
      previous?.stop(); processor.current?.stop(); processor.current = null;
      toast({ title: 'Efeito indisponível', description: 'Foi mantida a câmara original.' });
    }
  }, [refresh]);
  const setAudioProcessing = useCallback(async (options: MediaTrackConstraints) => {
    await roomRef.current?.localParticipant.getTrackPublication(sdkRef.current!.Track.Source.Microphone)?.audioTrack?.mediaStreamTrack.applyConstraints(options);
  }, []);
  return {
    state, initiateCall, answerCall, endCall, toggleMute, toggleVideo, toggleScreenShare, flipCamera,
    declineCall: async (id: string, _target: string) => {
      if (!user) return;
      const { data, error } = await supabase.rpc('finish_direct_call', { p_call_id: id, p_outcome: 'declined' });
      if (error) throw error;
      if (!data) throw new Error('A chamada já terminou ou foi atendida.');
    },
    markUserInteracted: () => { void roomRef.current?.startAudio(); },
    setVirtualBackground: (background: BgMode) => applyEffects({ background }),
    setCallEffects: applyEffects, setAudioProcessing,
    raiseHand: async (raised: boolean) => { if (callRef.current && user) await lifecycleRef.current.raiseHand(callRef.current, user.id, raised); },
    sendReaction: async (emoji: string) => { if (callRef.current && user) await lifecycleRef.current.sendReaction(callRef.current, user.id, emoji); },
  };
}
