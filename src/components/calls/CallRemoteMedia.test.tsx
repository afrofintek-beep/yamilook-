import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CallRemoteMedia } from './CallRemoteMedia';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('offers user-gesture audio recovery without unmuting a second video sink', async () => {
  vi.stubGlobal('MediaStream', class { constructor(public tracks: unknown[]) {} });
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function(this: HTMLMediaElement) {
    return this.tagName === 'AUDIO' && play.mock.calls.length <= 2 ? Promise.reject(new Error('autoplay')) : Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const stream = { getAudioTracks: () => [{ kind: 'audio' }], getVideoTracks: () => [{ kind: 'video' }] } as unknown as MediaStream;
  const { container } = render(<CallRemoteMedia stream={stream} showVideo />);
  expect(await screen.findByRole('button', { name: 'Activar som da chamada' })).toBeVisible();
  expect(container.querySelector('video')?.muted).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Activar som da chamada' }));
  await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument());
});
