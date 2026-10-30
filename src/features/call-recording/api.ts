import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
export interface RecordingSession {
  id: string;
  initiated_by: string;
  status: 'pending_consent' | 'recording' | 'paused' | 'processing' | 'completed' | 'stopped' | 'failed';
  deadline: string;
  consents: { user_id: string; consented: boolean; revoked_at: string | null }[];
}
export type RecordingAction = 'state' | 'request' | 'respond' | 'start' | 'cancel' | 'pause' | 'resume' | 'stop' | 'complete' | 'fail';
export async function recordingSession(callId: string, action: RecordingAction = 'state', id?: string,
  consent?: boolean, metadata?: Record<string, Json>): Promise<RecordingSession | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const { data, error } = await supabase.rpc('recording_session', {
      p_call_id: callId, p_action: action, p_recording_id: id,
      p_consent: consent, p_metadata: metadata,
    }).abortSignal(controller.signal);
    if (error) throw error;
    return data as unknown as RecordingSession | null;
  } finally { clearTimeout(timeout); }
}
