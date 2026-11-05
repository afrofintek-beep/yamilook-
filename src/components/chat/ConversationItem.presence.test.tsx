import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationItem } from './ConversationItem';

const conversation = (overrides = {}, type = 'direct') => ({
  id: 'chat', type, name: 'Grupo', avatar_url: null,
  participants: [{ user_id: 'other', profile: {
    id: 'other', display_name: 'Ana', username: 'ana', avatar_url: null,
    is_online: true, last_seen: new Date().toISOString(), show_online_status: true,
    ...overrides,
  } }],
  last_message: { content: 'Olá', message_type: 'text', sender_id: 'other', created_at: new Date().toISOString() },
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('visible online status in the conversation list', () => {
  it('shows a translated Online label without replacing the message preview', () => {
    render(<ConversationItem conversation={conversation()} currentUserId="me" onClick={vi.fn()} />);
    expect(screen.getByText('Online')).toBeVisible();
    expect(screen.getByText('Olá')).toBeVisible();
    expect(screen.getByRole('button', { name: /Ana.*Online/ })).toBeVisible();
  });
  it.each([
    { is_online: false },
    { show_online_status: false },
    { last_seen: new Date(Date.now() - 180_000).toISOString() },
  ])('hides offline, private or stale presence: %j', overrides => {
    render(<ConversationItem conversation={conversation(overrides)} currentUserId="me" onClick={vi.fn()} />);
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
  });
  it('can show online while the last-seen timestamp is private', () => {
    render(<ConversationItem conversation={conversation({ last_seen: null })} currentUserId="me" onClick={vi.fn()} />);
    expect(screen.getByText('Online')).toBeVisible();
  });
  it('never labels a group online based on one member', () => {
    render(<ConversationItem conversation={conversation({}, 'group')} currentUserId="me" onClick={vi.fn()} />);
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
  });
  it('removes the indicator when a lease expires without a final event', () => {
    vi.useFakeTimers();
    render(<ConversationItem conversation={conversation()} currentUserId="me" onClick={vi.fn()} />);
    expect(screen.getByText('Online')).toBeVisible();
    act(() => vi.advanceTimersByTime(120_000));
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
  });
});
