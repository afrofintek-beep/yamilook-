import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaPreview, MediaThumbnail } from './MediaPreview';

const { createSignedUrl } = vi.hoisted(() => ({ createSignedUrl: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: () => ({ createSignedUrl }) } } }));
const url = 'https://example.supabase.co/storage/v1/object/public/media/user/clip.mov';
beforeEach(() => {
  createSignedUrl.mockReset();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('Papos video presentation', () => {
  it('uses a saved cover without loading the original video or signing a public URL', () => {
    const { container } = render(<MediaThumbnail url={url} type="video" posterUrl="https://example.com/poster.jpg" durationSeconds={17} />);
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('poster', 'https://example.com/poster.jpg');
    expect(video).not.toHaveAttribute('src');
    expect(screen.getByText('0:17')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproduzir vídeo' })).toHaveStyle({ aspectRatio: '0.75' });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('asks for a frame after zero for older videos and keeps an explicit play button', () => {
    const onClick = vi.fn();
    const { container } = render(<MediaThumbnail url={url} type="video" onClick={onClick} />);
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('src', `${url}#t=0.1`);
    Object.defineProperty(video, 'duration', { value: 16.75 });
    fireEvent.loadedMetadata(video);
    expect(screen.getByText('0:17')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir vídeo' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('opens the actual video with native sound controls and pauses it when closed', () => {
    const { rerender } = render(<MediaPreview url={url} type="video" open onClose={vi.fn()} />);
    const video = screen.getByLabelText('Vídeo da conversa') as HTMLVideoElement;
    expect(video).toHaveAttribute('src', url);
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('playsinline');
    expect(video.muted).toBe(false);
    expect(screen.getAllByRole('button', { name: 'Fechar pré-visualização' })).toHaveLength(1);
    rerender(<MediaPreview url={url} type="video" open={false} onClose={vi.fn()} />);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('keeps a labelled close action available after a playback error and pauses on close', async () => {
    const onClose = vi.fn();
    render(<MediaPreview url="https://example.com/broken.mov" type="video" open onClose={onClose} />);
    fireEvent.error(screen.getByLabelText('Vídeo da conversa'));
    await screen.findByRole('alert');
    const close = screen.getByRole('button', { name: 'Fechar pré-visualização' });
    expect(close).toHaveTextContent('Fechar');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('signs a legacy private object only on error and reports a second failure', async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.supabase.co/storage/v1/object/sign/media/clip.mov?token=test' }, error: null });
    render(<MediaPreview url={url} type="video" open onClose={vi.fn()} />);
    fireEvent.error(screen.getByLabelText('Vídeo da conversa'));
    await waitFor(() => expect(screen.getByLabelText('Vídeo da conversa')).toHaveAttribute('src', expect.stringContaining('/object/sign/')));
    fireEvent.error(screen.getByLabelText('Vídeo da conversa'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tenta novamente');
    expect(createSignedUrl).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Descarregar ficheiro' })).toHaveAttribute('href', expect.stringContaining('download=clip.mov'));
  });

  it('retries failures and keeps the preview visible rather than silently closing', async () => {
    const onClose = vi.fn();
    render(<MediaPreview url="https://example.com/broken.mov" type="video" open onClose={onClose} />);
    fireEvent.error(screen.getByLabelText('Vídeo da conversa'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
