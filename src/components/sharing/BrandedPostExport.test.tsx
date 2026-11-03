import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BrandedPostExport from './BrandedPostExport';
import { getExportIdentity, prepareOwnedPostMedia, getOwnedMediaDescriptor } from '@/lib/owned-post-media';
import { brandImage, brandText } from '@/lib/branded-media';
import { canShareVideo, sharePreparedVideo } from '../../../shared/post-video-sharing.mjs';
vi.mock('@/lib/owned-post-media', () => ({ getExportIdentity: vi.fn(), prepareOwnedPostMedia: vi.fn(), getOwnedMediaDescriptor: vi.fn() }));
vi.mock('@/lib/branded-media', () => ({ brandImage: vi.fn(), brandText: vi.fn() }));
vi.mock('../../../shared/post-video-sharing.mjs', () => ({ canShareVideo: vi.fn(), sharePreparedVideo: vi.fn() }));
const identity = { content: 'Cerimónia AFIS', author: { name: 'Antonio', username: 'tony' } };
const file = new File(['branded'], 'cartao.jpg', { type: 'image/jpeg' });
beforeEach(() => {
  vi.resetAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn();
  vi.mocked(getExportIdentity).mockResolvedValue(identity);
  vi.mocked(prepareOwnedPostMedia).mockResolvedValue(file);
  vi.mocked(getOwnedMediaDescriptor).mockResolvedValue({ url: 'https://example.test/photo.jpg', downloadUrl: '', filename: '', type: 'image/jpeg' });
  vi.mocked(brandImage).mockResolvedValue(file); vi.mocked(brandText).mockResolvedValue([file]);
  vi.mocked(canShareVideo).mockReturnValue(true); vi.mocked(sharePreparedVideo).mockResolvedValue('shared');
});
afterEach(cleanup);
it('requires preview and a second user tap, sends only the branded file and revokes URLs', async () => {
  const shared = vi.fn(); const view = render(<BrandedPostExport id="id" mediaUrls={['https://example.test/photo.jpg']} onShared={shared} />);
  expect(getExportIdentity).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Preparar cópia com marca'));
  const button = await screen.findByText('Confirmar e escolher aplicação');
  expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:preview');
  expect(sharePreparedVideo).not.toHaveBeenCalled();
  fireEvent.click(button); expect(sharePreparedVideo).toHaveBeenCalledWith(file);
  await screen.findByText(/Cópia entregue/); expect(shared).toHaveBeenCalledOnce();
  view.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
});
it('supports text-only posts and offers each page without truncating to the first', async () => {
  vi.mocked(brandText).mockResolvedValue([file, new File(['second'], 'page2.jpg', { type: 'image/jpeg' })]);
  render(<BrandedPostExport id="id" mediaUrls={[]} />);
  fireEvent.click(screen.getByText('Preparar cópia com marca'));
  await screen.findByText('Pré-visualização da cópia');
  expect(prepareOwnedPostMedia).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Cartão a enviar'), { target: { value: '1' } });
  expect(screen.getByText(/page2.jpg/)).toBeInTheDocument();
});
it('discards output when authorization fails or content changes during export', async () => {
  vi.mocked(getExportIdentity).mockResolvedValueOnce(identity).mockResolvedValueOnce({ ...identity, content: 'edited' });
  render(<BrandedPostExport id="id" mediaUrls={[]} />);
  fireEvent.click(screen.getByText('Preparar cópia com marca'));
  await screen.findByText(/publicação ou o autor mudou/);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(sharePreparedVideo).not.toHaveBeenCalled();
});
it('keeps download and preview when native file sharing is unsupported', async () => {
  vi.mocked(canShareVideo).mockReturnValue(false);
  render(<BrandedPostExport id="id" mediaUrls={[]} />);
  fireEvent.click(screen.getByText('Preparar cópia com marca'));
  expect(await screen.findByRole('link', { name: 'Guardar cópia com marca' })).toHaveAttribute('download', 'cartao.jpg');
  expect(screen.queryByText('Confirmar e escolher aplicação')).not.toBeInTheDocument();
});
it('aborts preparation on unmount and prevents stale output', async () => {
  vi.mocked(getExportIdentity).mockImplementation((_id, signal) => new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
  const view = render(<BrandedPostExport id="id" mediaUrls={[]} />);
  fireEvent.click(screen.getByText('Preparar cópia com marca'));
  const signal = vi.mocked(getExportIdentity).mock.calls[0][1];
  view.unmount(); expect(signal?.aborted).toBe(true);
});
