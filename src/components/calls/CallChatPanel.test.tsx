import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CallChatPanel } from './CallChatPanel';
const { sendMessage, useMessages, createConversation } = vi.hoisted(() => ({sendMessage:vi.fn(),useMessages:vi.fn(),createConversation:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'me'}})}));
vi.mock('@/hooks/useChat',()=>({useMessages}));
vi.mock('@/lib/chat-conversations',()=>({createChatConversation:createConversation}));
vi.mock('@/components/chat/EnhancedMessageBubble',()=>({EnhancedMessageBubble:()=>null}));
beforeEach(()=>{
  vi.resetAllMocks();
  useMessages.mockReturnValue({messages:[],reactions:{},starredIds:new Set(),pinnedIds:new Set(),viewOnceViewedIds:new Set(),markViewOnce:vi.fn(),loading:false,sendMessage});
});
afterEach(cleanup);
it('sends to the existing call conversation and clears the draft only after success',async()=>{
  sendMessage.mockResolvedValue({error:null});
  render(<CallChatPanel conversationId="conversation" onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Mensagem durante a chamada'),{target:{value:'Mensagem na chamada'}});
  fireEvent.click(screen.getByRole('button',{name:'Enviar'}));
  await waitFor(()=>expect(sendMessage).toHaveBeenCalledWith('Mensagem na chamada'));
  await waitFor(()=>expect(screen.getByLabelText('Mensagem durante a chamada')).toHaveValue(''));
  expect(useMessages).toHaveBeenCalledWith('conversation');
  expect(createConversation).not.toHaveBeenCalled();
});
it('retains text on send failure and closes only the chat panel',async()=>{
  sendMessage.mockResolvedValue({error:new Error('offline')});
  const onClose=vi.fn();
  render(<CallChatPanel conversationId="conversation" onClose={onClose} />);
  fireEvent.change(screen.getByLabelText('Mensagem durante a chamada'),{target:{value:'Manter rascunho'}});
  fireEvent.click(screen.getByRole('button',{name:'Enviar'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('O texto foi mantido');
  expect(screen.getByLabelText('Mensagem durante a chamada')).toHaveValue('Manter rascunho');
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Close'}));
  expect(onClose).toHaveBeenCalledOnce();
});
