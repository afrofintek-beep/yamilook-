import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMediaCapture } from './useMediaCapture';
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const settings = { videoEnabled: true, audioEnabled: true, noiseSuppression: true, echoCancellation: true };
afterEach(() => vi.unstubAllGlobals());
it.each(['NotAllowedError', 'SecurityError'])('does not retry explicit permission refusal: %s', async name => {
  const capture = vi.fn().mockRejectedValue(new DOMException('denied', name));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
  const { result } = renderHook(() => useMediaCapture());
  await act(async () => { await expect(result.current.getUserMedia(settings)).rejects.toMatchObject({ name }); });
  expect(capture).toHaveBeenCalledTimes(1);
  expect(result.current.localStream).toBeNull();
});
it('keeps audio fallback for unavailable camera and stops after a denied fallback', async () => {
  const capture = vi.fn().mockRejectedValueOnce(new DOMException('no camera', 'NotFoundError')).mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
  const { result } = renderHook(() => useMediaCapture());
  await act(async () => { await expect(result.current.getUserMedia(settings)).rejects.toMatchObject({ name: 'NotAllowedError' }); });
  expect(capture).toHaveBeenCalledTimes(2);
});
it('captures audio when camera unavailable and releases it on cleanup', async () => {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ kind: 'audio', enabled: true, stop }], getVideoTracks: () => [] };
  const capture = vi.fn().mockRejectedValueOnce(new DOMException('no camera', 'NotFoundError')).mockResolvedValueOnce(stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
  const { result } = renderHook(() => useMediaCapture());
  await act(async () => { await result.current.getUserMedia(settings); });
  expect(result.current.isVideoEnabled).toBe(false);
  act(() => result.current.stopAllMedia());
  expect(stop).toHaveBeenCalledOnce();
});
