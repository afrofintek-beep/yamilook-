import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickMimeType } from './useCallRecorder';
afterEach(() => vi.unstubAllGlobals());
describe('call recording formats', () => {
  it('uses MP4 on devices without WebM support', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (type: string) => type === 'video/mp4' });
    expect(pickMimeType()).toBe('video/mp4');
  });
  it('lets the browser choose when no explicit format is supported', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false });
    expect(pickMimeType()).toBeUndefined();
  });
});
