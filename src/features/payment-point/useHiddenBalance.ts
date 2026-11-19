import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
export function useHiddenBalance() {
  const { user } = useAuth();
  const key = `wallet-hide-balance:${user?.id || 'guest'}`;
  const read = () => { try { return localStorage.getItem(key) === 'true'; } catch { return false; } };
  const [preference, setPreference] = useState({ key, hidden: read() });
  const hidden = preference.key === key ? preference.hidden : read();
  function setHidden(value: boolean) {
    try { localStorage.setItem(key, String(value)); } catch { /* Storage may be unavailable. */ }
    setPreference({ key, hidden: value });
  }
  return [hidden, setHidden] as const;
}
