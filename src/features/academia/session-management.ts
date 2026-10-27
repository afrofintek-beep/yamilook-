import type { AcademiaSession } from './hooks/useAcademia';
export type SessionAction = 'archive' | 'restore' | 'cancel' | 'delete';
export type SessionFilter = 'upcoming' | 'past' | 'cancelled' | 'archived';
export function sessionMatches(s: AcademiaSession, filter: SessionFilter, now = Date.now()) {
  if (filter === 'archived') return !!s.archivedAt;
  if (s.archivedAt) return false;
  if (filter === 'cancelled') return s.status === 'cancelled';
  if (s.status === 'cancelled') return false;
  const past = ['ended', 'completed'].includes(s.status) || (s.status !== 'live' && Date.parse(s.scheduledAt) <= now);
  return filter === 'past' ? past : !past;
}
export function sessionActions(s: AcademiaSession, now = Date.now()): SessionAction[] {
  if (s.archivedAt) return ['restore'];
  const actions: SessionAction[] = [];
  if (s.status !== 'live' && (Date.parse(s.scheduledAt) <= now || ['ended', 'completed', 'cancelled'].includes(s.status))) actions.push('archive');
  if (['scheduled', 'draft'].includes(s.status)) actions.push('cancel', 'delete');
  return actions;
}
