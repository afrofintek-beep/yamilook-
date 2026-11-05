import type { Session } from '@supabase/supabase-js';
const KEY = 'yamilook-password-recovery';
let marker: { id: string; until: number } | null = null;
function id(session: Session | null): string | null {
  try {
    const part = session?.access_token.split('.')[1];
    if (!part) return null;
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof claims.session_id === 'string' ? claims.session_id : null;
  } catch { return null; }
}
// This marker controls UI only. Supabase verifies the session and password write.
export const recoverySession = {
  begin(session: Session | null) {
    const sessionId = id(session);
    if (!sessionId) return;
    marker = { id: sessionId, until: Date.now() + 3600000 };
    try { sessionStorage.setItem(KEY, JSON.stringify(marker)); } catch { /* memory fallback */ }
  },
  matches(session: Session | null) {
    try { marker = JSON.parse(sessionStorage.getItem(KEY) || 'null') || marker; } catch { /* memory fallback */ }
    return !!marker && marker.until > Date.now() && marker.id === id(session);
  },
  clear() {
    marker = null;
    try { sessionStorage.removeItem(KEY); } catch { /* memory fallback */ }
  },
};
