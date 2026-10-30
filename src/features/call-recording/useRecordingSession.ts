import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCallRecorder } from '@/hooks/useCallRecorder';
import { recordingSession, type RecordingAction, type RecordingSession } from './api';

const verificationError = 'Não foi possível verificar os consentimentos. A gravação permanece desactivada até recuperar a ligação.';

const active = (s: RecordingSession | null) => s && ['pending_consent', 'recording', 'paused', 'processing'].includes(s.status);

export function useRecordingSession(callId: string, userId: string | undefined,
  localStream: MediaStream | null, remoteStreams: Map<string, MediaStream>) {
  const recorder = useCallRecorder();
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [localRecording, setLocalRecording] = useState(false);
  const media = useRef({ localStream, remoteStreams });
  media.current = { localStream, remoteStreams };
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  const owned = useRef<string | null>(null);
  const capturing = useRef(false);
  const working = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(true);

  const discard = useCallback(async () => {
    capturing.current = false;
    setLocalRecording(false);
    await recorderRef.current.stop();
  }, []);

  const run = useCallback(async (action: RecordingAction, id?: string, consent?: boolean) => {
    if (working.current) return;
    working.current = true;
    revision.current++;
    setBusy(true);
    setError('');
    try {
      const next = await recordingSession(callId, action, id, consent);
      if (!mounted.current) {
        if (action === 'request' && next) void recordingSession(callId, 'cancel', next.id).catch(() => {});
        return;
      }
      if (action === 'request' && next) owned.current = next.id;
      if (action === 'start' && next?.status === 'recording') {
        const streams = media.current;
        if (!recorderRef.current.start(streams.localStream, streams.remoteStreams)) {
          await recordingSession(callId, 'fail', next.id);
          owned.current = null;
          setSession(null);
          throw new Error('media_unavailable');
        }
        capturing.current = true;
        setLocalRecording(true);
        setDuration(0);
      }
      if (action === 'pause') recorderRef.current.pause(true);
      if (action === 'resume') recorderRef.current.pause(false);
      if (action === 'cancel') {
        owned.current = null;
        await discard();
      }
      setSession(next);
    } catch {
      if (action === 'start') {
        owned.current = null;
        if (id) void recordingSession(callId, 'fail', id).catch(() => {});
      }
      if (mounted.current) setError(action === 'respond'
        ? 'Não foi possível guardar a sua resposta. Tente novamente.'
        : 'Não foi possível concluir o pedido de gravação. Verifique a ligação e tente novamente.');
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [callId, discard]);

  // A database snapshot on mount, reconnect and every two seconds recovers lost
  // Realtime notifications. Never let a stale read overwrite a mutation response.
  useEffect(() => {
    mounted.current = true;
    let alive = true;
    let reading = false;
    const refresh = async () => {
      if (!alive || reading || working.current || !userId) return;
      reading = true;
      const version = revision.current;
      try {
        const next = await recordingSession(callId);
        if (!alive || version !== revision.current || working.current) return;
        if (capturing.current && (!next || next.id !== owned.current || !['recording', 'paused'].includes(next.status))) {
          await discard();
          owned.current = null;
          setError('A gravação foi interrompida porque o pedido terminou ou os participantes mudaram.');
        }
        setError(previous => previous === verificationError ? '' : previous);
        setSession(next);
      } catch {
        if (alive && version === revision.current) {
          // Do not continue capturing when consent can no longer be verified.
          if (capturing.current) {
            const id = owned.current;
            owned.current = null;
            await discard();
            if (id) void recordingSession(callId, 'fail', id).catch(() => {});
          }
          setError(verificationError);
        }
      } finally { reading = false; }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 2000);
    window.addEventListener('online', refresh);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      mounted.current = false;
      revision.current++;
      clearInterval(interval);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      const id = owned.current;
      owned.current = null;
      capturing.current = false;
      void recorderRef.current.stop();
      if (id) void recordingSession(callId, 'cancel', id).catch(() => {});
    };
  }, [callId, userId, discard]);

  useEffect(() => {
    if (busy || session?.status !== 'pending_consent' || owned.current !== session.id) return;
    if (Date.parse(session.deadline) <= Date.now()) {
      void run('cancel', session.id);
      return;
    }
    if (session.consents.every(c => c.consented && !c.revoked_at)) void run('start', session.id);
  }, [session, busy, run]);

  useEffect(() => {
    if (session?.status !== 'pending_consent') return;
    const timer = setTimeout(() => {
      if (owned.current === session.id) void run('cancel', session.id);
      setError('O prazo de 60 segundos terminou. Pode enviar um novo pedido.');
    }, Math.max(0, Date.parse(session.deadline) - Date.now()));
    return () => clearTimeout(timer);
  }, [session?.id, session?.status, session?.deadline, run]);

  useEffect(() => {
    if (!localRecording || session?.status !== 'recording') return;
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, [localRecording, session?.status]);

  const stop = async () => {
    if (working.current || !session || owned.current !== session.id || !capturing.current) return;
    working.current = true;
    revision.current++;
    setBusy(true);
    setError('');
    const id = session.id;
    capturing.current = false;
    setLocalRecording(false);
    const mediaResult = recorderRef.current.stop();
    try {
      await recordingSession(callId, 'stop', id);
      const blob = await mediaResult;
      if (!blob?.size) throw new Error('empty_recording');
      const path = `${callId}/${id}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
      const { error: uploadError } = await supabase.storage.from('call-recordings')
        .upload(path, blob, { contentType: blob.type || 'video/webm', upsert: false });
      if (uploadError) throw uploadError;
      const next = await recordingSession(callId, 'complete', id, undefined, {
        storage_path: path, file_size_bytes: blob.size, duration_seconds: duration,
      });
      if (mounted.current) setSession(next);
    } catch {
      await discard();
      void recordingSession(callId, 'fail', id).catch(() => {});
      if (mounted.current) setError('Não foi possível guardar a gravação.');
    } finally {
      owned.current = null;
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return { session, busy, error, duration, localRecording, hasActiveSession: !!active(session),
    request: () => run('request'), respond: (answer: boolean) => run('respond', session?.id, answer),
    cancel: () => run('cancel', session?.id),
    togglePause: () => run(session?.status === 'paused' ? 'resume' : 'pause', session?.id), stop };
}
