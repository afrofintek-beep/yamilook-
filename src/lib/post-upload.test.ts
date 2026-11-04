import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ options: null as any, getSession: vi.fn(), abort: vi.fn(), start: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.getSession } } }));
vi.mock('tus-js-client', () => ({ Upload: class { constructor(_file: File, options: any) { mocks.options = options; } abort = mocks.abort; start = mocks.start; } }));
import { postUploadEndpoint, uploadPostFile } from './post-upload';
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-key');
  mocks.abort.mockResolvedValue(undefined); mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
const file = () => new File(['video'], 'clip.MOV', { type: '' });
it('uses direct storage with MOV MIME, chunk retries, real progress and server acknowledgement', async () => {
  const progress = vi.fn(); const pending = uploadPostFile(file(), 'owner/clip.mov', { onProgress: progress });
  expect(mocks.options.endpoint).toBe('https://example.storage.supabase.co/storage/v1/upload/resumable');
  expect(mocks.options.chunkSize).toBe(6 * 1024 * 1024);
  expect(mocks.options.metadata).toMatchObject({ objectName: 'owner/clip.mov', contentType: 'video/quicktime' });
  const request = { getURL: () => mocks.options.endpoint, setHeader: vi.fn() };
  await mocks.options.onBeforeRequest(request);
  expect(request.setHeader).toHaveBeenCalledWith('authorization', 'Bearer test-token');
  expect(request.setHeader).toHaveBeenCalledWith('x-upsert', 'false');
  mocks.options.onProgress(5, 10); expect(progress).toHaveBeenLastCalledWith(50);
  mocks.options.onProgress(10, 10); expect(progress).toHaveBeenLastCalledWith(99);
  mocks.options.onSuccess(); await pending; expect(progress).toHaveBeenLastCalledWith(100); expect(vi.getTimerCount()).toBe(0);
});
it('aborts a stalled upload and ignores late success', async () => {
  const progress = vi.fn(); const pending = uploadPostFile(file(), 'owner/clip.mov', { onProgress: progress });
  const rejected = expect(pending).rejects.toThrow(/sem resposta/);
  await vi.advanceTimersByTimeAsync(120_000); await rejected;
  expect(mocks.abort).toHaveBeenCalledOnce(); mocks.options.onSuccess(); expect(progress).not.toHaveBeenCalledWith(100);
});
it('cancels pending authorization without allowing a later request to send', async () => {
  let resolve: (value: any) => void; mocks.getSession.mockReturnValue(new Promise(r => { resolve = r; }));
  const controller = new AbortController(); const pending = uploadPostFile(file(), 'owner/clip.mov', { signal: controller.signal });
  const request = { getURL: () => mocks.options.endpoint, setHeader: vi.fn() };
  const before = mocks.options.onBeforeRequest(request); const beforeRejected = expect(before).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort(); await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  resolve!({ data: { session: { access_token: 'test-token' } }, error: null }); await beforeRejected;
  expect(request.setHeader).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('rejects permanent permission and size failures rather than endlessly retrying', async () => {
  const pending = uploadPostFile(file(), 'owner/clip.mov');
  expect(mocks.options.onShouldRetry({ originalResponse: { getStatus: () => 403 } })).toBe(false);
  expect(mocks.options.onShouldRetry({ originalResponse: { getStatus: () => 503 } })).toBe(true);
  mocks.options.onError({ originalResponse: { getStatus: () => 413 } }); await expect(pending).rejects.toThrow(/limite/);
});
it('does not forward credentials to a different upload origin', async () => {
  const controller = new AbortController(); const pending = uploadPostFile(file(), 'owner/clip.mov', { signal: controller.signal });
  await expect(mocks.options.onBeforeRequest({ getURL: () => 'https://other.example/upload' })).rejects.toThrow(/inválido/);
  expect(mocks.getSession).not.toHaveBeenCalled(); controller.abort(); await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(postUploadEndpoint('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321/storage/v1/upload/resumable');
});
