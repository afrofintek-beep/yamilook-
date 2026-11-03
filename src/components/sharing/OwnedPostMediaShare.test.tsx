import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OwnedPostMediaShare from './OwnedPostMediaShare';
import { getOwnedMediaDescriptor, prepareOwnedPostMedia } from '@/lib/owned-post-media';
import { canShareVideo, sharePreparedVideo } from '../../../shared/post-video-sharing.mjs';

vi.mock('@/lib/owned-post-media', () => ({ getOwnedMediaDescriptor: vi.fn(), prepareOwnedPostMedia: vi.fn() }));
vi.mock('../../../shared/post-video-sharing.mjs', async original => ({ ...await original(), canShareVideo: vi.fn(), sharePreparedVideo: vi.fn() }));
const urls = ['https://example.test/a.jpg', 'https://example.test/b.mp4'];
const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prepareOwnedPostMedia).mockResolvedValue(file);
  vi.mocked(canShareVideo).mockReturnValue(true);
  vi.mocked(sharePreparedVideo).mockResolvedValue('shared');
  vi.mocked(getOwnedMediaDescriptor).mockResolvedValue({ url: urls[0], downloadUrl: `${urls[0]}?download=photo.jpg`, filename: 'photo.jpg', type: 'image/jpeg' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('does not fetch on open and sends only a prepared file after a separate tap', async () => {
  const onShared = vi.fn();
  render(<OwnedPostMediaShare id="post" mediaUrls={urls} onShared={onShared} />);
  expect(prepareOwnedPostMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Preparar ficheiro' }));
  const button = await screen.findByRole('button', { name: 'Escolher aplicação' });
  expect(sharePreparedVideo).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(sharePreparedVideo).toHaveBeenCalledWith(file);
  await screen.findByText(/Ficheiro entregue/);
  expect(onShared).toHaveBeenCalledOnce();
});
it('validates the owner before offering a download and expires the link', async () => {
  vi.useFakeTimers();
  render(<OwnedPostMediaShare id="post" mediaUrls={urls} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Descarregar ficheiro' })));
  expect(getOwnedMediaDescriptor).toHaveBeenCalledWith('post', 0, expect.any(AbortSignal));
  expect(screen.getByRole('link', { name: 'Guardar ficheiro' })).toHaveAttribute('href', `${urls[0]}?download=photo.jpg`);
  await act(async () => vi.advanceTimersByTime(30000));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('does not offer a download when the server rejects authorization', async () => {
  vi.mocked(getOwnedMediaDescriptor).mockRejectedValue(new Error('Sem autorização'));
  render(<OwnedPostMediaShare id="post" mediaUrls={urls} />);
  fireEvent.click(screen.getByRole('button', { name: 'Descarregar ficheiro' }));
  await screen.findByText('Sem autorização');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('cancels on selection changes and closing, and discards prepared files', async () => {
  const { unmount } = render(<OwnedPostMediaShare id="post" mediaUrls={urls} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preparar ficheiro' }));
  await screen.findByRole('button', { name: 'Escolher aplicação' });
  vi.mocked(prepareOwnedPostMedia).mockReturnValue(new Promise(() => {}));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
  expect(screen.queryByRole('button', { name: 'Escolher aplicação' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Preparar ficheiro' }));
  const signal = vi.mocked(prepareOwnedPostMedia).mock.calls.at(-1)[2].signal;
  unmount();
  expect(signal.aborted).toBe(true);
});
it('recovers from a timeout instead of leaving the preparation stuck', async () => {
  vi.useFakeTimers();
  vi.mocked(prepareOwnedPostMedia).mockReturnValue(new Promise(() => {}));
  render(<OwnedPostMediaShare id="post" mediaUrls={urls} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preparar ficheiro' }));
  await act(async () => vi.advanceTimersByTime(120000));
  expect(screen.getByRole('status')).toHaveTextContent('demorou demasiado');
  expect(screen.getByRole('button', { name: 'Preparar ficheiro' })).toBeEnabled();
});
it('keeps download available when native sharing is unsupported', async () => {
  vi.mocked(canShareVideo).mockReturnValue(false);
  render(<OwnedPostMediaShare id="post" mediaUrls={urls} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preparar ficheiro' }));
  await screen.findByText(/Este navegador/);
  expect(screen.queryByRole('button', { name: 'Escolher aplicação' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Descarregar ficheiro' })).toBeEnabled();
});
