import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForwardMessageSheet } from './ForwardMessageSheet';

const { rpc, toast } = vi.hoisted(() => ({ rpc: vi.fn(), toast: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useChat', () => ({
  useMessages: () => ({ messages: [] }),
  useConversations: () => ({ conversations: [{ id: 'destination', type: 'group', name: 'Banda', participants: [] }] }),
}));
vi.mock('@/components/ui/responsive-modal', () => ({
  ResponsiveModal: ({ children, title }: { children: React.ReactNode; title: React.ReactNode }) => <div>{title}{children}</div>,
}));
beforeEach(() => { rpc.mockReset(); toast.mockReset(); });
afterEach(cleanup);
const message = { id: 'real-source-id', content: 'video.mp4', message_type: 'video', media_url: 'https://example.com/video.mp4', sender_id: 'other' };

function selectDestination() { fireEvent.click(screen.getByRole('button', { name: /Banda/ })); }

describe('Papos forwarding confirmation', () => {
  it('forwards the real source ID and only reports success after confirmation', async () => {
    rpc.mockResolvedValue({ data: 1, error: null });
    const onOpenChange = vi.fn();
    render(<ForwardMessageSheet open message={message} onOpenChange={onOpenChange} />);
    selectDestination();
    fireEvent.click(screen.getByRole('button', { name: 'Reencaminhar' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(rpc).toHaveBeenCalledExactlyOnceWith('forward_chat_messages', {
      p_message_ids: ['real-source-id'], p_conversation_ids: ['destination'],
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Mensagens reencaminhadas' }));
  });

  it('keeps destinations selected on a database failure and allows retry', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } }).mockResolvedValue({ data: 1, error: null });
    const onOpenChange = vi.fn();
    render(<ForwardMessageSheet open message={message} onOpenChange={onOpenChange} />);
    selectDestination();
    fireEvent.click(screen.getByRole('button', { name: 'Reencaminhar' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Banda/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Reencaminhar' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('validates all selected source IDs on the server even when some are not locally loaded', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'unavailable source' } });
    render(<ForwardMessageSheet open messageIds={['one', 'two']} conversationId="source" onOpenChange={vi.fn()} />);
    selectDestination();
    fireEvent.click(screen.getByRole('button', { name: 'Reencaminhar' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('forward_chat_messages', {
      p_message_ids: ['one', 'two'], p_conversation_ids: ['destination'],
    }));
  });

  it('does not report success for an unconfirmed result or submit twice while pending', async () => {
    let resolve!: (result: { data: number; error: null }) => void;
    rpc.mockImplementation(() => new Promise(done => { resolve = done; }));
    const onOpenChange = vi.fn();
    render(<ForwardMessageSheet open message={message} onOpenChange={onOpenChange} />);
    selectDestination();
    const button = screen.getByRole('button', { name: 'Reencaminhar' });
    fireEvent.click(button); fireEvent.click(button);
    expect(rpc).toHaveBeenCalledOnce();
    await act(async () => { resolve({ data: 0, error: null }); });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });
});
