import { uiText } from '@/i18n/ui-copy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { unlockCallAudio } from '@/lib/audio-context';
import { saveRecording } from './save';
import { downloadRecording, type PendingRecording } from './pending';
import { useCallRecorder } from '@/hooks/useCallRecorder';
import { recordingSession, type RecordingAction, type RecordingSession } from './api';

const verificationError = 'Não foi possível verificar os consentimentos. A gravação permanece desactivada até recuperar a ligação.';

const active = (s: RecordingSession | null) => s && ['pending_consent', 'recording', 'paused', 'processing'].includes(s.status);

export function useRecordingSession(callId: string, userId: string | undefined,
  localStream: MediaStream | null, remoteStreams: Map<string, MediaStream>,
  localScreen: MediaStream | null = null, remoteScreens?: Map<string, MediaStream>) {
  const recorder = useCallRecorder();
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const pendingFile = useRef<PendingRecording | null>(null);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [localRecording, setLocalRecording] = useState(false);
  const media = useRef({ localStream, remoteStreams, localScreen, remoteScreens });
  media.current = { localStream, remoteStreams, localScreen, remoteScreens };
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  const owned = useRef<string | null>(null);
  const capturing = useRef(false);
  const working = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(true);
  const finalize = useRef<() => Promise<void>>(async () => {});
  const durationRef = useRef(0);
  durationRef.current = duration;

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
        if ((action === 'request' || action === 'start') && next) void recordingSession(callId, 'cancel', next.id).catch(() => {});
        return;
      }
      if (action === 'request' && next) owned.current = next.id;
      if (action === 'start' && next?.status === 'recording') {
        const streams = media.current;
        if (!recorderRef.current.start(streams.localStream, streams.remoteStreams, streams.localScreen, streams.remoteScreens)) {
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
        ? uiText("Não foi possível guardar a sua resposta. Tente novamente.")
        : uiText("Não foi possível concluir o pedido de gravação. Verifique a ligação e tente novamente."));
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [callId, discard]);

  useEffect(() => {
    if (!capturing.current || !owned.current) return;
    if (!recorderRef.current.update(localStream, remoteStreams, localScreen, remoteScreens)) {
      const id = owned.current;
      owned.current = null;
      void discard();
      void recordingSession(callId, 'fail', id).catch(() => {});
      setError(uiText("A gravação foi interrompida porque não foi possível actualizar o áudio ou vídeo."));
    }
  }, [callId, localStream, remoteStreams, localScreen, remoteScreens, discard]);

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
          if (next?.id === owned.current && next.status === 'processing') {
            void finalize.current();
          } else {
            await discard();
            owned.current = null;
            setError(uiText("A gravação foi interrompida porque o pedido terminou ou os participantes mudaram."));
          }
        }
        setError(previous => previous === verificationError ? '' : previous);
        setSession(next);
      } catch {
        if (alive && version === revision.current) {
          // Do not continue capturing when consent can no longer be verified.
          if (capturing.current) {
            // Stop immediately, retaining only the already consented media.
            // Saving rechecks authorization after connectivity recovers.
            void finalize.current();
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
      if (capturing.current) {
        // The promise survives route teardown; persist before trying the network.
        void finalize.current();
      } else if (!working.current && !pendingFile.current) {
        owned.current = null;
        void recorderRef.current.stop();
        if (id) void recordingSession(callId, 'cancel', id).catch(() => {});
      }
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
      setError(uiText("O prazo de 60 segundos terminou. Pode enviar um novo pedido."));
    }, Math.max(0, Date.parse(session.deadline) - Date.now()));
    return () => clearTimeout(timer);
  }, [session?.id, session?.status, session?.deadline, run]);

  useEffect(() => {
    if (!localRecording || session?.status !== 'recording') return;
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, [localRecording, session?.status]);

  const save = async () => {
    const file = pendingFile.current;
    if (!file || working.current) return;
    working.current = true;
    revision.current++;
    setBusy(true);
    setError('');
    try {
      const next = await saveRecording(file);
      pendingFile.current = null;
      owned.current = null;
      if (mounted.current) { setSession(next); setRetryAvailable(false); }
    } catch (cause) {
      if (mounted.current) {
        setRetryAvailable(true);
        setError(cause instanceof Error ? cause.message : uiText("Não foi possível guardar a gravação."));
      }
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const download = () => {
    if (pendingFile.current) downloadRecording(pendingFile.current);
  };

  const stop = async () => {
    if (!owned.current || !userId || !capturing.current) return;
    const id = owned.current;
    working.current = true;
    revision.current++;
    setBusy(true);
    setError('');
    capturing.current = false;
    setLocalRecording(false);
    const blob = await recorderRef.current.stop();
    if (blob?.size) {
      pendingFile.current = { id, callId, ownerId: userId, blob, duration: durationRef.current, createdAt: Date.now() };
      working.current = false;
      await save();
    } else {
      void recordingSession(callId, 'fail', id).catch(() => {});
      owned.current = null;
      working.current = false;
      if (mounted.current) {
        setBusy(false);
        setError(uiText("O navegador não entregou dados da gravação. Não foi criado um ficheiro."));
      }
    }
  };

  finalize.current = stop;

  return { session, busy, error, duration, localRecording, retryAvailable, retrySave: save, download, hasActiveSession: !!active(session),
    request: () => { unlockCallAudio(); return run('request'); }, respond: (answer: boolean) => run('respond', session?.id, answer),
    cancel: () => run('cancel', session?.id),
    togglePause: () => run(session?.status === 'paused' ? 'resume' : 'pause', session?.id), stop };
}
