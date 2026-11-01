import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ParticipantGrid } from './ParticipantGrid';
vi.mock('./CallRemoteMedia', () => ({ CallRemoteMedia: () => <video data-testid="remote-media" /> }));
afterEach(cleanup);
const people = ['Ana', 'Jessica', 'Tony'].map(name => ({ id: name, user_id: name, display_name: name, avatar_url: null, is_muted: false, is_video_enabled: true, is_screen_sharing: false, is_hand_raised: false, is_spotlight: false }));
const stream = { getVideoTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream;
const props = { participants: people, localStream: null, remoteStreams: new Map(people.map(p => [p.user_id, stream])), screenStream: null, isScreenSharing: false, callType: 'video' as const };
it('selects any participant and returns to the grid without remounting media', () => {
  const onSelectParticipant = vi.fn();
  render(<ParticipantGrid {...props} onSelectParticipant={onSelectParticipant} />);
  const media = screen.getAllByTestId('remote-media');
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar Jessica' }));
  expect(screen.getByRole('button', { name: 'Ampliar Jessica' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar Ana' }));
  expect(screen.getByRole('button', { name: 'Ampliar Ana' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Ampliar Jessica' })).toHaveAttribute('aria-pressed', 'false');
  screen.getAllByTestId('remote-media').forEach((element, i) => expect(element).toBe(media[i]));
  fireEvent.click(screen.getByRole('button', { name: 'Ver todos' }));
  expect(screen.getByRole('button', { name: 'Ampliar Ana' })).toHaveAttribute('aria-pressed', 'false');
  expect(onSelectParticipant).toHaveBeenCalledTimes(2);
});
it('clears selection when a participant leaves', () => {
  const { rerender } = render(<ParticipantGrid {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar Jessica' }));
  rerender(<ParticipantGrid {...props} participants={[people[0], people[2]]} remoteStreams={new Map()} />);
  expect(screen.queryByRole('button', { name: 'Ver todos' })).not.toBeInTheDocument();
});
it('lets stream-only participants be enlarged before metadata arrives', () => {
  render(<ParticipantGrid {...props} participants={[]} remoteStreams={new Map([['new', stream]])} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar Participante' }));
  expect(screen.getByRole('button', { name: 'Ampliar Participante' })).toHaveAttribute('aria-pressed', 'true');
});
