import { createRef } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CallChatPanel } from './CallChatPanel';

const { sendMessage, useMessages, createConversation } = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  useMessages: vi.fn(),
  createConversation: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/hooks/useChat', () => ({ useMessages }));
vi.mock('@/lib/chat-conversations', () => ({ createChatConversation: createConversation }));
vi.mock('@/components/chat/EnhancedMessageBubble', () => ({ EnhancedMessageBubble: () => null }));

beforeEach(() => {
  vi.resetAllMocks();
  useMessages.mockReturnValue({
    messages: [], reactions: {}, starredIds: new Set(), pinnedIds: new Set(),
    viewOnceViewedIds: new Set(), markViewOnce: vi.fn(), loading: false, sendMessage,
  });
});
afterEach(cleanup);

it('allows direct writing without media permission and sends to the existing conversation', async () => {
  const getUserMedia = vi.fn();
  const previousMediaDevices = navigator.mediaDevices;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  try {
    sendMessage.mockResolvedValue({ error: null });
    render(<CallChatPanel conversationId="conversation" open inputRef={createRef<HTMLTextAreaElement>()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Escrever mensagem'), { target: { value: 'Mensagem na chamada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('Mensagem na chamada'));
    await waitFor(() => expect(screen.getByLabelText('Escrever mensagem')).toHaveValue(''));
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(useMessages).toHaveBeenCalledWith('conversation');
    expect(createConversation).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: previousMediaDevices });
  }
});

it('retains a failed message and closes only the chat, without ending the call', async () => {
  sendMessage.mockResolvedValue({ error: new Error('offline') });
  const onClose = vi.fn();
  render(<CallChatPanel conversationId="conversation" open inputRef={createRef<HTMLTextAreaElement>()} onClose={onClose} />);
  fireEvent.change(screen.getByLabelText('Escrever mensagem'), { target: { value: 'Manter rascunho' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A mensagem foi conservada');
  expect(screen.getByLabelText('Escrever mensagem')).toHaveValue('Manter rascunho');
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à chamada' }));
  expect(onClose).toHaveBeenCalledOnce();
});

it('preserves the draft while switching between the ongoing call and its chat', () => {
  const inputRef = createRef<HTMLTextAreaElement>();
  const onClose = vi.fn();
  const { rerender } = render(<CallChatPanel conversationId="conversation" open inputRef={inputRef} onClose={onClose} />);
  fireEvent.change(screen.getByLabelText('Escrever mensagem'), { target: { value: 'Até já' } });
  rerender(<CallChatPanel conversationId="conversation" open={false} inputRef={inputRef} onClose={onClose} />);
  rerender(<CallChatPanel conversationId="conversation" open inputRef={inputRef} onClose={onClose} />);
  expect(screen.getByLabelText('Escrever mensagem')).toHaveValue('Até já');
});

it('allows composing while the destination conversation is being resolved', async () => {
  createConversation.mockResolvedValue({ data: { id: 'new-conversation' }, error: null });
  sendMessage.mockResolvedValue({ error: null });
  render(<CallChatPanel contactId="contact" open inputRef={createRef<HTMLTextAreaElement>()} onClose={vi.fn()} />);
  const input = screen.getByLabelText('Escrever mensagem');
  expect(input).not.toBeDisabled();
  fireEvent.change(input, { target: { value: 'Olá' } });
  await waitFor(() => expect(useMessages).toHaveBeenCalledWith('new-conversation'));
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
  await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('Olá'));
});
