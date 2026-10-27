import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePaposViewport } from './usePaposViewport';

afterEach(() => vi.unstubAllGlobals());

it('tracks keyboard height and pan, preserves pinch zoom and cleans up', () => {
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 800);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { fn(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const { unmount } = renderHook(() => usePaposViewport());
  const style = document.documentElement.style;
  expect(style.getPropertyValue('--kosolola-height')).toBe('800px');
  act(() => {
    Object.assign(viewport, { height: 400, offsetTop: 20 });
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(style.getPropertyValue('--kosolola-height')).toBe('400px');
  expect(style.getPropertyValue('--kosolola-top')).toBe('20px');
  expect(style.getPropertyValue('--kosolola-bottom')).toBe('380px');
  act(() => {
    Object.assign(viewport, { height: 200, scale: 2 });
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(style.getPropertyValue('--kosolola-height')).toBe('400px');
  act(() => {
    Object.assign(viewport, { height: 800, offsetTop: 0, scale: 1 });
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(style.getPropertyValue('--kosolola-height')).toBe('800px');
  unmount();
  viewport.dispatchEvent(new Event('resize'));
  expect(style.getPropertyValue('--kosolola-height')).toBe('');
});

it('uses the window height when VisualViewport is unavailable', () => {
  vi.stubGlobal('visualViewport', undefined);
  vi.stubGlobal('innerHeight', 600);
  const { unmount } = renderHook(() => usePaposViewport());
  expect(document.documentElement.style.getPropertyValue('--kosolola-height')).toBe('600px');
  unmount();
});
