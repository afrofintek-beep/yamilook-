import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMediaUpload } from './useMediaUpload';

const { upload, createVideoPoster } = vi.hoisted(() => ({ upload: vi.fn(), createVideoPoster: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: () => ({
  upload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.com/${path}` } }),
}) } } }));
vi.mock('@/lib/chat-media', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/chat-media')>(), createVideoPoster,
}));
beforeEach(() => { upload.mockReset().mockResolvedValue({ error: null }); createVideoPoster.mockReset(); });
afterEach(cleanup);

describe('Papos video uploads', () => {
  it('uploads a MOV with its correct MIME, a JPEG cover and duration metadata', async () => {
    createVideoPoster.mockResolvedValue({ blob: new Blob(['jpeg'], { type: 'image/jpeg' }), durationSeconds: 17 });
    const { result } = renderHook(useMediaUpload);
    let saved: Awaited<ReturnType<typeof result.current.uploadMedia>>;
    await act(async () => { saved = await result.current.uploadMedia(new File(['video'], 'clip.MOV', { type: '' }), 'video', { videoPoster: true }); });
    expect(upload.mock.calls[0][2]).toMatchObject({ contentType: 'video/quicktime' });
    expect(upload.mock.calls[1][0]).toBe(`${upload.mock.calls[0][0]}.poster.jpg`);
    expect(upload.mock.calls[1][2]).toMatchObject({ contentType: 'image/jpeg' });
    expect(saved!).toMatchObject({ thumbnailUrl: expect.stringContaining('.poster.jpg'), durationSeconds: 17 });
    expect(result.current.uploading).toBe(false);
  });

  it.each(['no decoder', 'cover upload failure'])('preserves the original on %s', async reason => {
    createVideoPoster.mockResolvedValue(reason === 'no decoder' ? null : { blob: new Blob(['jpeg']) });
    if (reason === 'cover upload failure') upload.mockResolvedValueOnce({ error: null }).mockRejectedValueOnce(new Error('cover failed'));
    const { result } = renderHook(useMediaUpload);
    let saved: Awaited<ReturnType<typeof result.current.uploadMedia>>;
    await act(async () => { saved = await result.current.uploadMedia(new File(['clip'], 'clip.mov'), 'video', { videoPoster: true }); });
    expect(saved!.url).toContain('clip.mov');
    expect(saved!.thumbnailUrl).toBeUndefined();
    expect(result.current.uploading).toBe(false);
  });
});
