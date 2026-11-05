import { supabase } from '@/integrations/supabase/client';
import { recordingSession, type RecordingSession } from './api';
import { keepRecording, removePendingRecording, type PendingRecording } from './pending';

const running = new Map<string, Promise<RecordingSession>>();
export function saveRecording(file: PendingRecording): Promise<RecordingSession> {
  const key = `${file.ownerId}:${file.id}`;
  const previous = running.get(key);
  if (previous) return previous;
  const task = save(file).finally(() => running.delete(key));
  running.set(key, task);
  return task;
}
async function save(file: PendingRecording): Promise<RecordingSession> {
  const durable = await keepRecording(file);
  let stage = 'preparar';
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== file.ownerId) throw new Error('account_changed');
    let state = await recordingSession(file.callId, 'state', file.id);
    if (state?.id !== file.id || state.initiated_by !== file.ownerId) throw new Error('recording_changed');
    if (state.consents.some(c => !c.consented || c.revoked_at)) {
      await removePendingRecording(file);
      throw new Error('consent_required');
    }
    if (state.status === 'recording' || state.status === 'paused') {
      state = await recordingSession(file.callId, 'stop', file.id);
    }
    if (state?.status !== 'processing' && state?.status !== 'completed') throw new Error('recording_closed');
    if (state.status !== 'completed') {
      stage = 'enviar';
      const path = `${file.callId}/${file.id}.${file.blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const upload = supabase.storage.from('call-recordings').upload(path, file.blob,
        { contentType: file.blob.type || 'video/webm', upsert: false });
      const { error } = await Promise.race([upload, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('upload_timeout')), 120_000);
      })]).finally(() => clearTimeout(timer));
      // A lost upload response may leave the immutable object already present.
      // Complete verifies its owner, exact path and actual size on the server.
      if (error && error.status !== 409 && !['409', 'Duplicate', 'ResourceAlreadyExists'].includes(String(error.statusCode))) throw error;
      stage = 'confirmar';
      state = await recordingSession(file.callId, 'complete', file.id, undefined, {
        storage_path: path, file_size_bytes: file.blob.size, duration_seconds: file.duration,
      });
      if (state?.status !== 'completed') throw new Error('not_completed');
    }
    await removePendingRecording(file);
    return state;
  } catch {
    throw new Error(`Não foi possível ${stage} a gravação. ${durable
      ? 'A cópia está guardada neste dispositivo. Pode tentar novamente em Chamadas → Gravações.'
      : 'Descarregue a cópia antes de fechar a aplicação; não foi possível guardá-la neste dispositivo.'}`);
  }
}
