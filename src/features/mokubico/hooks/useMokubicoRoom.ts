import { uiText } from '@/i18n/ui-copy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

export interface ConversaMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

interface Peer {
  id: string;
  name: string;
  speaking: boolean;
  videoTrack?: Track;
}

/** Group voice (LiveKit) + persistent text chat (mokubico_messages + realtime)
 *  for a Mokubico conversa. Everyone allowed in can talk; token enforces access. */
export function useMokubicoRoom(conversaId: string | null, roomName: string | null) {
  const { user, profile } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<ConversaMessage[]>([]);
  // Each member's read cursor (userId → last_read_at ISO) for ✓/✓✓ receipts.
  const [reads, setReads] = useState<Record<string, string>>({});
  // Participant avatars resolved by identity (= user id), which LiveKit omits.
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});

  // --- Persistent text chat: initial fetch + realtime inserts ---
  useEffect(() => {
    if (!conversaId) return;
    let cancelled = false;

    supabase
      .from('mokubico_messages')
      .select('id, sender_id, sender_name, text, created_at')
      .eq('conversa_id', conversaId)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setMessages(data.map((m) => ({
          id: m.id, senderId: m.sender_id, senderName: m.sender_name || 'Alguém', text: m.text, createdAt: m.created_at,
        })));
      });

    const ch = supabase
      .channel(`mok-msgs-${conversaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mokubico_messages', filter: `conversa_id=eq.${conversaId}` }, (payload) => {
        const m = payload.new as { id: string; sender_id: string; sender_name: string | null; text: string; created_at: string };
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [
          ...prev,
          { id: m.id, senderId: m.sender_id, senderName: m.sender_name || 'Alguém', text: m.text, createdAt: m.created_at },
        ]));
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [conversaId]);

  const sendMessage = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || !conversaId || !user) return;
    await supabase.from('mokubico_messages').insert({
      conversa_id: conversaId, sender_id: user.id, sender_name: profile?.display_name || 'Alguém', text: t,
    });
    // Realtime echoes it back to us (deduped by id), so no optimistic append.
  }, [conversaId, user, profile]);

  // --- Read receipts: mark my cursor, and track everyone's ---
  useEffect(() => {
    if (!conversaId || !user) return;
    supabase.from('mokubico_conversa_reads').upsert(
      { conversa_id: conversaId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: 'conversa_id,user_id' },
    ).then(() => { /* fire and forget */ });
  }, [conversaId, user, messages.length]);

  useEffect(() => {
    if (!conversaId) return;
    supabase
      .from('mokubico_conversa_reads')
      .select('user_id, last_read_at')
      .eq('conversa_id', conversaId)
      .then(({ data }) => {
        if (data) setReads(Object.fromEntries(data.map((r) => [r.user_id, r.last_read_at])));
      });
    const ch = supabase
      .channel(`mok-reads-${conversaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mokubico_conversa_reads', filter: `conversa_id=eq.${conversaId}` }, (payload) => {
        const r = payload.new as { user_id: string; last_read_at: string } | undefined;
        if (r?.user_id) setReads((prev) => ({ ...prev, [r.user_id]: r.last_read_at }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversaId]);

  // Resolve participant avatars (identity = user id) whenever the set changes.
  const peerIds = peers.map((p) => p.id).sort().join(',');
  useEffect(() => {
    const ids = peers.map((p) => p.id);
    if (!ids.length) return;
    supabase.rpc('get_public_profiles_by_ids', { p_ids: ids }).then(({ data }) => {
      if (data) setAvatars((prev) => ({ ...prev, ...Object.fromEntries(data.map((p) => [p.id, p.avatar_url])) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerIds]);

  // --- Group voice (LiveKit) ---
  const refreshPeers = useCallback((room: Room) => {
    const speaking = new Set(room.activeSpeakers.map((p) => p.identity));
    const all: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
    setPeers(all.map((p) => {
      const camPub = p.getTrackPublication(Track.Source.Camera);
      return {
        id: p.identity,
        name: p.name || 'Alguém',
        speaking: speaking.has(p.identity),
        videoTrack: camPub && !camPub.isMuted ? camPub.track ?? undefined : undefined,
      };
    }));
  }, []);

  const getToken = useCallback(async (): Promise<{ token: string; url: string } | null> => {
    if (!user || !roomName) return null;
    let { data: { session } } = await supabase.auth.getSession();
    if (session?.expires_at && session.expires_at * 1000 < Date.now() + 5000) {
      session = (await supabase.auth.refreshSession()).data.session;
    }
    if (!session?.access_token) return null;
    const { data, error: fnErr } = await supabase.functions.invoke('generate-livekit-token', {
      body: { roomName, participantName: profile?.display_name || 'User', participantIdentity: user.id, isHost: false },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (fnErr || !data?.token) return null;
    return { token: data.token, url: data.url };
  }, [user, profile, roomName]);

  const connect = useCallback(async () => {
    if (!roomName || roomRef.current || connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const creds = await getToken();
      if (!creds) throw new Error(uiText("Sem credenciais para entrar."));
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      const refresh = () => refreshPeers(room);
      room
        .on(RoomEvent.ParticipantConnected, refresh)
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.ActiveSpeakersChanged, refresh)
        .on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio) track.attach(); refresh(); })
        .on(RoomEvent.TrackUnsubscribed, refresh)
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.LocalTrackPublished, refresh)
        .on(RoomEvent.LocalTrackUnpublished, refresh)
        .on(RoomEvent.Disconnected, () => setConnected(false));
      await room.connect(creds.url, creds.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setMicOn(true);
      setConnected(true);
      refreshPeers(room);
    } catch (e) {
      logger.error('Mokubico room connect failed', 'mokubico', e);
      setError(e instanceof Error ? e.message : uiText("Falha ao entrar na sala."));
      roomRef.current?.disconnect();
      roomRef.current = null;
    } finally {
      setConnecting(false);
    }
  }, [roomName, connecting, getToken, refreshPeers]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [micOn]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
    refreshPeers(room);
  }, [camOn, refreshPeers]);

  const leave = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => () => { roomRef.current?.disconnect(); roomRef.current = null; }, []);

  return { connect, leave, toggleMic, toggleCamera, sendMessage, connected, connecting, error, micOn, camOn, peers, messages, reads, avatars, selfId: user?.id ?? '' };
}
