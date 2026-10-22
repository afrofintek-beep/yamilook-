import { describe, expect, it } from 'vitest';
import { isRecentlyOnline } from './online-presence';
const now = Date.parse('2026-10-22T20:00:00Z');
describe('online presence expiry', () => {
  it('requires a recent signal and an active server flag', () => {
    expect(isRecentlyOnline(true, new Date(now - 30_000).toISOString(), now)).toBe(true);
    expect(isRecentlyOnline(false, new Date(now).toISOString(), now)).toBe(false);
  });
  it('expires after two minutes even without an offline event', () => {
    expect(isRecentlyOnline(true, new Date(now - 120_000).toISOString(), now)).toBe(false);
    expect(isRecentlyOnline(true, '2026-07-01T00:00:00Z', now)).toBe(false);
  });
  it('does not trust missing, malformed or far-future signals', () => {
    for (const date of [null, undefined, 'invalid', '2099-01-01T00:00:00Z']) expect(isRecentlyOnline(true, date, now)).toBe(false);
  });
});
