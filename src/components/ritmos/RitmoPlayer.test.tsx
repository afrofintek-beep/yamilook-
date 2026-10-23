import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RitmoPlayer } from './RitmoPlayer';
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
const props = { ritmo: { id: 'r', user_id: 'u', video_url: 'video.mp4', created_at: new Date().toISOString(), caption: null, market: null, city: null, neighborhood: null, is_promoted: false, view_count: 0 }, onReact: vi.fn(), onComment: vi.fn(), onShare: vi.fn() };
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('removes pending playback when a Ritmo becomes inactive', () => {
  const { container, rerender } = render(<MemoryRouter><RitmoPlayer {...props} isActive /></MemoryRouter>);
  const video = container.querySelector('video')!;
  rerender(<MemoryRouter><RitmoPlayer {...props} isActive={false} /></MemoryRouter>);
  fireEvent.canPlay(video);
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  expect(video).not.toHaveAttribute('poster');
  expect(video).toHaveAttribute('preload', 'none');
});
it('does not restart playback when parent callbacks change', () => {
  const { rerender } = render(<MemoryRouter><RitmoPlayer {...props} isActive onView={() => {}} /></MemoryRouter>);
  const loads = vi.mocked(HTMLMediaElement.prototype.load).mock.calls.length;
  rerender(<MemoryRouter><RitmoPlayer {...props} isActive onView={() => {}} /></MemoryRouter>);
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(loads);
});
