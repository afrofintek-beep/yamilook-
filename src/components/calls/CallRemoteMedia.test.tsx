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
it('keeps playing the same audio when video or its stream wrapper changes', async () => {
  vi.stubGlobal('MediaStream', class { constructor(public tracks: unknown[]) {} });
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const audio = { kind: 'audio' };
  const stream = { getAudioTracks: () => [audio], getVideoTracks: () => [] } as unknown as MediaStream;
  const { container, rerender, unmount } = render(<CallRemoteMedia stream={stream} showVideo={false} />);
  await waitFor(() => expect(play).toHaveBeenCalled());
  const element = container.querySelector('audio')!;
  const attached = element.srcObject;
  pause.mockClear(); play.mockClear();
  rerender(<CallRemoteMedia stream={stream} showVideo />);
  rerender(<CallRemoteMedia stream={{ ...stream } as MediaStream} showVideo={false} />);
  expect(element.srcObject).toBe(attached);
  expect(pause.mock.contexts.filter(e => (e as HTMLMediaElement).tagName === 'AUDIO')).toHaveLength(0);
  expect(play.mock.contexts.filter(e => (e as HTMLMediaElement).tagName === 'AUDIO')).toHaveLength(0);
  unmount();
  expect(element.srcObject).toBeNull();
});
it('attaches replacement audio and clears it when the remote microphone is muted', async () => {
  vi.stubGlobal('MediaStream', class { constructor(public tracks: unknown[]) {} });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const make = (tracks: unknown[]) => ({ getAudioTracks: () => tracks, getVideoTracks: () => [] }) as unknown as MediaStream;
  const { container, rerender } = render(<CallRemoteMedia stream={make([{kind:'audio'}])} showVideo={false} />);
  const element = container.querySelector('audio')!;
  const initial = element.srcObject;
  rerender(<CallRemoteMedia stream={make([{kind:'audio'}])} showVideo={false} />);
  expect(element.srcObject).not.toBe(initial);
  rerender(<CallRemoteMedia stream={make([])} showVideo={false} />);
  expect(element.srcObject).toBeNull();
});
