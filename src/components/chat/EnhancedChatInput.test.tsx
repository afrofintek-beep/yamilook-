import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnhancedChatInput } from './EnhancedChatInput';

vi.mock('@/hooks/useMediaUpload', () => ({
  useVoiceRecorder: () => ({ isRecording: false }),
  useMediaUpload: () => ({ uploading: false, uploadMedia: vi.fn() }),
}));
vi.mock('./StickerPicker', () => ({ StickerPicker: () => null }));
vi.mock('./GifPicker', () => ({ GifPicker: () => null }));
vi.mock('./EmojiPanel', () => ({ EmojiPanel: () => null }));
vi.mock('./ScheduleMessageSheet', () => ({ ScheduleMessageSheet: () => null }));
afterEach(cleanup);

describe('Papos draft recovery', () => {
  it('keeps the text and reply on failure, then clears them after a successful retry', async () => {
    const onSend = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ messageId: 'saved' });
    const onCancelReply = vi.fn();
    render(<EnhancedChatInput onSend={onSend} onTyping={vi.fn()} conversationId="chat"
      replyTo={{ id: 'original', content: 'Olá', message_type: 'text' }} onCancelReply={onCancelReply} />);
    const input = screen.getByRole('textbox', { name: 'Mensagem' });
    fireEvent.change(input, { target: { value: 'Resposta por enviar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('O texto foi mantido');
    expect(input).toHaveValue('Resposta por enviar');
    expect(onCancelReply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(onSend).toHaveBeenLastCalledWith('Resposta por enviar', 'text', undefined, 'original');
    expect(onCancelReply).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the draft if the backend returns no message confirmation', async () => {
    render(<EnhancedChatInput onSend={vi.fn().mockResolvedValue({})} onTyping={vi.fn()} conversationId="chat" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Olá' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Olá');
  });

  it('prevents repeated submissions and preserves new text typed during delivery', async () => {
    let resolve!: (result: { messageId: string }) => void;
    const onSend = vi.fn(() => new Promise<{ messageId: string }>(done => { resolve = done; }));
    render(<EnhancedChatInput onSend={onSend} onTyping={vi.fn()} conversationId="chat" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Primeira mensagem' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { value: 'Novo rascunho' } });
    await act(async () => { resolve({ messageId: 'saved' }); });
    expect(input).toHaveValue('Novo rascunho');
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeEnabled();
  });

  it('focuses the input for the list reply action after loading', () => {
    const props = { onSend: vi.fn(), onTyping: vi.fn(), conversationId: 'chat', focusInput: true };
    const { rerender } = render(<EnhancedChatInput {...props} disabled />);
    rerender(<EnhancedChatInput {...props} disabled={false} />);
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
});
