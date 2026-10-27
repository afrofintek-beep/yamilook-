import { describe, expect, it } from 'vitest';
import { sessionActions, sessionMatches } from './session-management';
import type { AcademiaSession } from './hooks/useAcademia';
const now = Date.parse('2026-10-27T12:00:00Z');
const s = { id: 's', mentorId: 'm', status: 'scheduled', scheduledAt: '2026-10-28T12:00:00Z' } as AcademiaSession;
describe('Academia lifecycle filters', () => {
  it('shows future sessions, hides past ones without silently declaring them completed', () => {
    expect(sessionMatches(s, 'upcoming', now)).toBe(true);
    const past = { ...s, scheduledAt: '2026-10-26T12:00:00Z' };
    expect(sessionMatches(past, 'upcoming', now)).toBe(false);
    expect(sessionMatches(past, 'past', now)).toBe(true);
    expect(past.status).toBe('scheduled');
  });
  it('keeps live sessions available after their scheduled time', () => {
    expect(sessionMatches({ ...s, status: 'live', scheduledAt: '2026-10-26' }, 'upcoming', now)).toBe(true);
  });
  it('separates cancelled, ended, and archived sessions', () => {
    expect(sessionMatches({ ...s, status: 'cancelled' }, 'cancelled', now)).toBe(true);
    expect(sessionMatches({ ...s, status: 'completed' }, 'past', now)).toBe(true);
    const archived = { ...s, archivedAt: '2026-10-27' };
    expect(sessionMatches(archived, 'upcoming', now)).toBe(false);
    expect(sessionMatches(archived, 'archived', now)).toBe(true);
    expect(sessionActions(archived, now)).toEqual(['restore']);
  });
  it('never offers cancellation or deletion for started or completed sessions', () => {
    for (const status of ['live', 'ended', 'completed', 'cancelled']) {
      expect(sessionActions({ ...s, status }, now)).not.toContain('cancel');
      expect(sessionActions({ ...s, status }, now)).not.toContain('delete');
    }
    expect(sessionActions(s, now)).not.toContain('archive');
  });
});
