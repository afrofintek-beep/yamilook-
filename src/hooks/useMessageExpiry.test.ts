import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
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

it('keeps the message list identity stable across unrelated renders', () => {
  const messages = [{ id: 'permanent', expires_at: null }];
  const { result, rerender } = renderHook(() => useMessageExpiry(messages));
  const original = result.current;
  for (let i = 0; i < 10; i++) rerender();
  expect(result.current).toBe(original);
});

it('does not retrigger a highlights-style effect when its response updates component state', async () => {
  const messages = [{ id: 'one', expires_at: null }];
  const loadHighlights = vi.fn();
  const { result } = renderHook(() => {
    const visible = useMessageExpiry(messages);
    const [responses, setResponses] = useState(0);
    useEffect(() => {
      loadHighlights();
      // Cap a regression loop so the test fails instead of hanging.
      if (responses < 5) setResponses(count => count + 1);
    }, [visible]);
    return responses;
  });
  await act(async () => {});
  expect(loadHighlights).toHaveBeenCalledOnce();
  expect(result.current).toBe(1);
});
