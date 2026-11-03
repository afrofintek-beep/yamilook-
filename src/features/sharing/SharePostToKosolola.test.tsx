import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SharePostToKosolola from './SharePostToKosolola';
const { fetchPost, send, create, refresh } = vi.hoisted(() => ({ fetchPost: vi.fn(), send:vi.fn(),create:vi.fn(),refresh:vi.fn() }));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'me'}})}));
vi.mock('@/hooks/useChat',()=>({useConversations:()=>({conversations:[{id:'family',type:'group',name:'Família'},{id:'direct',type:'direct',participants:[{user_id:'friend',profile:{display_name:'Amigo'}}]}],loading:false,refresh})}));
vi.mock('@/hooks/useContacts',()=>({useContacts:()=>({contacts:[{contact_user_id:'new',profile:{display_name:'Novo contacto'}},{contact_user_id:'blocked',is_blocked:true,profile:{display_name:'Bloqueado'}}],loading:false})}));
vi.mock('@/lib/chat-conversations',()=>({createChatConversation:create}));
vi.mock('./send-shared-post',()=>({sendSharedPost:send}));
vi.mock('@/components/sharing/PostSharePreview',()=>({default:()=> <div>Pré-visualização</div>,fetchSharedPost:fetchPost}));
const id='be23e228-a441-44ea-a14c-5368fd8097a7';
beforeEach(()=> { vi.resetAllMocks();fetchPost.mockResolvedValue({id});send.mockResolvedValue(undefined);create.mockResolvedValue({data:{id:'new-conversation'}}); });
afterEach(cleanup);
function mount(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={['/share/post/'+id]}><Routes><Route path="/share/post/:postId" element={<SharePostToKosolola/>}/><Route path="/chat/:id" element={<p>Conversa aberta</p>}/></Routes></MemoryRouter></QueryClientProvider>);}
it('requires explicit selection and send, then opens the chosen group',async()=>{
  mount();expect(screen.getByRole('button',{name:'Seleciona um contacto ou grupo'})).toBeDisabled();
  fireEvent.click(await screen.findByRole('button',{name:/Família/}));expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Enviar para Família'}));
  await screen.findByText('Conversa aberta');expect(send).toHaveBeenCalledWith(expect.objectContaining({postId:id,conversationId:'family',userId:'me'}));expect(create).not.toHaveBeenCalled();
});
it('searches contacts and creates a direct conversation only on Send',async()=>{
  mount();const search=await screen.findByRole('textbox',{name:'Procurar contacto ou grupo'});fireEvent.change(search,{target:{value:'Novo'}});
  expect(screen.queryByRole('button',{name:/Família/})).not.toBeInTheDocument();expect(screen.queryByText('Bloqueado')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/Novo contacto/}));expect(create).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Enviar para Novo contacto'}));
  await screen.findByText('Conversa aberta');expect(create).toHaveBeenCalledWith(['new']);expect(send).toHaveBeenCalledWith(expect.objectContaining({conversationId:'new-conversation'}));
});
it('revalidates public visibility before sending',async()=>{
  mount();fireEvent.click(await screen.findByRole('button',{name:/Família/}));fetchPost.mockResolvedValue(null);fireEvent.click(screen.getByRole('button',{name:'Enviar para Família'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('já não é pública');expect(send).not.toHaveBeenCalled();
});
it('preserves selection and message ID on retry after a failed send',async()=>{
  send.mockRejectedValueOnce(new Error('Falhou'));mount();fireEvent.click(await screen.findByRole('button',{name:/Família/}));fireEvent.click(screen.getByRole('button',{name:'Enviar para Família'}));
  await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Enviar para Família'}));await screen.findByText('Conversa aberta');
  expect(send.mock.calls[0][0].id).toBe(send.mock.calls[1][0].id);
});
