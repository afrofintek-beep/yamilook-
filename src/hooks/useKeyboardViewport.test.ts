import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useKeyboardViewport } from './useKeyboardViewport';
afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); });
it('tracks keyboard and pan locally, ignores zoom, restores and removes listeners', () => {
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 800);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { fn(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const input = document.createElement('input'); document.body.append(input);
  const remove = vi.spyOn(viewport, 'removeEventListener');
  const { result, rerender } = renderHook(({ open }) => useKeyboardViewport(open), { initialProps: { open: true } });
  expect(result.current.style?.['--group-viewport-height']).toBe('800px');
  act(() => {
    input.focus(); Object.assign(viewport, { height: 350, offsetTop: 30 });
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(result.current.style?.['--group-viewport-bottom']).toBe('420px');
  expect(result.current.compact).toBe(true);
  act(() => { Object.assign(viewport, { scale: 2, height: 175 }); viewport.dispatchEvent(new Event('resize')); });
  expect(result.current.style?.['--group-viewport-height']).toBe('350px');
  act(() => { input.blur(); Object.assign(viewport, { scale: 1, height: 800, offsetTop: 0 }); viewport.dispatchEvent(new Event('resize')); });
  expect(result.current.compact).toBe(false);
  expect(result.current.style?.['--group-viewport-bottom']).toBe('0px');
  rerender({ open: false });
  expect(result.current.style).toBeUndefined();
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  expect(document.documentElement.style.getPropertyValue('--group-viewport-height')).toBe('');
});
it('supports browsers without VisualViewport', () => {
  vi.stubGlobal('visualViewport', undefined); vi.stubGlobal('innerHeight', 500);
  const { result } = renderHook(() => useKeyboardViewport(true));
  expect(result.current.style?.['--group-viewport-height']).toBe('500px');
});
