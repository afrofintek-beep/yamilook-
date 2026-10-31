export interface TimedSession {
  id: string;
  status: string;
  duration_minutes?: number;
  started_at?: string | null;
  ended_at?: string | null;
}

export function sessionTiming(session: TimedSession, now: number) {
  const start = Date.parse(session.started_at ?? '');
  const end = Date.parse(session.ended_at ?? '');
  const duration = session.duration_minutes ?? 60;
  const elapsed = Number.isFinite(start) ? Math.max(0, Math.floor(((Number.isFinite(end) ? end : now) - start) / 1000)) : null;
  return { duration, elapsed, remaining: elapsed === null ? null : duration * 60 - elapsed };
}

export function formatSessionTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}

