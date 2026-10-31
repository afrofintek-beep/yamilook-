import { supabase } from '@/integrations/supabase/client';

/** Server checks actual LiveKit presence; client clock/visibility is not proof
 * that a call ended. Failures must not prevent a healthy call from starting. */
export async function reconcileDirectCalls(body: { calleeId?: string; callId?: string } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const { error } = await supabase.functions.invoke('reconcile-direct-calls', { body, signal: controller.signal });
    if (error) console.warn('Não foi possível confirmar o estado remoto das chamadas.');
  } catch { /* Offline: existing busy checks and termination polling remain authoritative. */ }
  finally { clearTimeout(timeout); }
}
