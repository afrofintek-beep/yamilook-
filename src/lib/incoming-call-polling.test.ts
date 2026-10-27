import { describe, expect, it } from 'vitest';
import { shouldPollIncomingCall } from './incoming-call-polling';

describe('incoming-call polling fallback', () => {
  it('polls each 2s when realtime is down in foreground', () => {
    expect(shouldPollIncomingCall({ now: 2999, lastCheckAt: 1000, subscribed: false, visible: true })).toBe(false);
    expect(shouldPollIncomingCall({ now: 3000, lastCheckAt: 1000, subscribed: false, visible: true })).toBe(true);
  });
  it('suppresses extra polling with healthy realtime, without disabling fallback', () => {
    expect(shouldPollIncomingCall({ now: 11000, lastCheckAt: 1000, subscribed: true, visible: true })).toBe(false);
    expect(shouldPollIncomingCall({ now: 13000, lastCheckAt: 1000, subscribed: true, visible: true })).toBe(true);
  });
  it('reduces background queries and always permits first check', () => {
    expect(shouldPollIncomingCall({ now: 13000, lastCheckAt: 1000, subscribed: true, visible: false })).toBe(false);
    expect(shouldPollIncomingCall({ now: 40000, lastCheckAt: 1000, subscribed: true, visible: false })).toBe(true);
    expect(shouldPollIncomingCall({ now: 10, lastCheckAt: 0, subscribed: false, visible: true })).toBe(true);
  });
});
