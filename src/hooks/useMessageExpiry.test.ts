import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMessageExpiry } from './useMessageExpiry';
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('removes text and images at expiry without a server event, preserving permanent messages', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-24T00:00:00Z'));
  const messages = [{id:'text',expires_at:'2026-10-24T00:00:01Z'}, {id:'image',expires_at:'2026-10-24T00:00:02Z'}, {id:'permanent',expires_at:null}];
  const { result } = renderHook(() => useMessageExpiry(messages));
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.map(m => m.id)).toEqual(['image','permanent']);
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.map(m => m.id)).toEqual(['permanent']);
});
it('rechecks expiry on return from a suspended application', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-24T00:00:00Z'));
  const messages = [{expires_at:'2026-10-25T00:00:00Z'}];
  const { result } = renderHook(() => useMessageExpiry(messages));
  act(() => { vi.setSystemTime(new Date('2026-10-26T00:00:00Z')); window.dispatchEvent(new Event('pageshow')); });
  expect(result.current).toEqual([]);
});
