import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AudioInterruption } from './AudioInterruption';

it('reports interruption, retries from a tap, and clears on hardware recovery', async () => {
  const track = Object.assign(new EventTarget(), { muted: false, readyState: 'live' });
  const stream = { getAudioTracks: () => [track] } as unknown as MediaStream;
  const recover = vi.fn().mockResolvedValue(undefined);
  const report = vi.fn();
  render(<AudioInterruption stream={stream} muted={false} recover={recover} report={report} />);
  act(() => { track.muted = true; track.dispatchEvent(new Event('mute')); });
  expect(report).toHaveBeenLastCalledWith(true);
  await act(async () => fireEvent.click(screen.getByRole('button')));
  expect(recover).toHaveBeenCalledOnce();
  act(() => { track.muted = false; track.dispatchEvent(new Event('unmute')); });
  expect(report).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole('button')).toBeNull();
});
