import { useEffect, useMemo, useReducer } from 'react';

/** Re-render at expiry even when no new database/realtime event arrives. */
export function useMessageExpiry<T extends { expires_at?: string | null }>(messages: T[]): T[] {
  const [revision, refresh] = useReducer(value => value + 1, 0);
  useEffect(() => {
    const future = messages.map(message => Date.parse(message.expires_at || ''))
      .filter(expiry => Number.isFinite(expiry) && expiry > Date.now());
    const timer = future.length ? window.setTimeout(refresh,
      Math.min(Math.max(1, Math.min(...future) - Date.now()), 2_147_483_647)) : undefined;
    const resume = () => refresh();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
    };
  }, [messages, revision]);
  // Keep the list stable between actual message/expiry changes. Consumers use
  // this list in effects; a fresh array on every render caused a highlights
  // request -> setState -> render -> request loop in the chat screen.
  return useMemo(() => {
    const now = Date.now();
    return messages.filter(message => !message.expires_at || Date.parse(message.expires_at) > now);
  }, [messages, revision]);
}
