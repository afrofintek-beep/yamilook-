import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PaposSettings from './PaposSettings';
import PaposLogin from './PaposLogin';
import { PaposGate } from './PaposApp';
import { supabase } from '@/integrations/supabase/client';
import { AppSurfaceContext } from '@/lib/app-surface';
const { auth } = vi.hoisted(()=>({auth:{user:null as null|{id:string},profile:null as null|{display_name:string,onboarding_completed:boolean},loading:false,signOut:vi.fn(),signIn:vi.fn(),updateProfile:vi.fn(),refreshProfile:vi.fn()}}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>auth,AuthProvider:({children}:{children:React.ReactNode})=>children}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:vi.fn((name: string)=>Promise.resolve({data:name === 'can_issue_user_invitation' ? true : name === 'list_invitation_campaigns' ? [{ id: 'campaign', name: 'Campanha KOSOLOLA', status: 'active', eligible: true, starts_at: '2020-01-01', ends_at: '2099-01-01', max_per_user: 10, max_total: 100, my_issued: 0, total_issued: 0 }] : name === 'campaign_report' ? { issued: 0, used: 0, expired: 0, pending: 0, invitations: [] } : name === 'issue_campaign_invitation' ? { code: 'A123456789ABCDEF', expires_at: '2030-01-01' } : [],error:null}))}}));
vi.mock('@/components/settings/ArchivedChatsSheet',()=>({ArchivedChatsSheet:()=>null}));
vi.mock('@/components/settings/BlockedUsersSheet',()=>({BlockedUsersSheet:()=>null}));
beforeEach(()=>{
  auth.user={id:'user'};auth.profile={display_name:'Nome privado',onboarding_completed:true};auth.signOut.mockReset();
});
afterEach(cleanup);
function Back(){const navigate=useNavigate();return <button onClick={()=>navigate(-1)}>Voltar no histórico</button>;}
function setup(){
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(['private'],{text:'Histórico privado'});
  render(<AppSurfaceContext.Provider value="papos"><QueryClientProvider client={client}><MemoryRouter initialEntries={['/papos','/settings']} initialIndex={1}>
    <Back /><Routes>
      <Route path="/settings" element={<PaposGate><PaposSettings /></PaposGate>} />
      <Route path="/papos" element={<PaposGate><p>Histórico privado</p></PaposGate>} />
      <Route path="/login" element={<PaposLogin />} />
    </Routes>
  </MemoryRouter></QueryClientProvider></AppSurfaceContext.Provider>);
  return client;
}
it('signs out locally, clears cached data and displays branded sign-in confirmation',async()=>{
  auth.signOut.mockImplementation(async()=>{auth.user=null;auth.profile=null;});const client=setup();
  fireEvent.click(screen.getByRole('button',{name:'Terminar sessão'}));
  expect(await screen.findByText('Sessão terminada. Entra novamente para aceder às tuas conversas.')).toBeInTheDocument();
  expect(auth.signOut).toHaveBeenCalledExactlyOnceWith('local');
  expect(client.getQueryData(['private'])).toBeUndefined();
  expect(screen.queryByText('Nome privado')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toHaveValue('');
  expect(screen.getByLabelText('Palavra-passe')).toHaveValue('');
  fireEvent.click(screen.getByRole('button',{name:'Voltar no histórico'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Entrar na KOSOLOLA'})).toBeInTheDocument());
  expect(screen.queryByText('Histórico privado')).not.toBeInTheDocument();
});
it('shows a failed sign-out without claiming success',async()=>{
  auth.signOut.mockRejectedValue(new Error('offline'));setup();
  fireEvent.click(screen.getByRole('button',{name:'Terminar sessão'}));
  expect(await screen.findByText(/Não foi possível confirmar a saída/)).toBeInTheDocument();
  expect(screen.queryByText('Sessão terminada. Entra novamente para aceder às tuas conversas.')).not.toBeInTheDocument();
});
it('returns from settings to conversations without signing out',async()=>{
  setup();fireEvent.click(screen.getByRole('link',{name:'Voltar às conversas'}));
  expect(await screen.findByText('Histórico privado')).toBeInTheDocument();expect(auth.signOut).not.toHaveBeenCalled();
});

it('opens authorized campaign invitations from KOSOLOLA settings without legacy emission',async()=>{
  setup();fireEvent.click(screen.getByRole('button',{name:'Convidar amigos'}));
  expect(await screen.findByRole('dialog',{name:'Convidar para a KOSOLOLA'})).toBeInTheDocument();
  await screen.findByRole('option', { name: 'Campanha KOSOLOLA — Ativa' });
  expect(screen.queryByRole('button', { name: 'Convidar pelo WhatsApp' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Campanha'), { target: { value: 'campaign' } });
  fireEvent.click(screen.getByRole('button', { name: 'Emitir convite da campanha' }));
  const whatsapp = await screen.findByRole('link', { name: 'Partilhar no WhatsApp' });
  expect(new URL(whatsapp.getAttribute('href')!).searchParams.get('text')).toContain('KOSOLOLA');
  expect(screen.getByRole('link', { name: 'Preparar email' })).toBeInTheDocument();
  expect(supabase.rpc).not.toHaveBeenCalledWith('issue_shareable_user_invitation', expect.anything());
});
