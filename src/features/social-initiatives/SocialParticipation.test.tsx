import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: { id: 'user-one' } as {id:string}|null, invoke: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock('@/features/talatona-fair/FairAddressStep', () => ({ default: () => <p>Endereço</p> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: state.invoke } } }));
import SocialParticipation from './SocialParticipation';
const catalog = { name:'Feira',status:'active',starts_at:'2020-01-01',ends_at:'2099-01-01',goal_invites:5,require_attendance:true,condominiums:[{id:'adelaide',name:'Adelaide',area:'Talatona'}] };
const blank = { registration:null,address_valid:false,completed_invites:0,awarded:false,invitations:[] };
function mount(path='/feira-natalicia-talatona') {
 const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><SocialParticipation /></MemoryRouter></QueryClientProvider>);
}
beforeEach(()=>{state.user={id:'user-one'};state.invoke.mockReset();});
it('saves consent and condominium and displays the persisted registration',async()=>{
 let registered=false;
 state.invoke.mockImplementation(async (_:string,{body}:{body:{action:string}})=>{
  if(body.action==='catalog') return {data:catalog};
  if(body.action==='register') registered=true;
  return {data:{...blank,registration:registered?{user_id:'user-one',condominium_id:'adelaide',is_public:false}:null}};
 });
 mount();
 fireEvent.change(await screen.findByLabelText('Condomínio'),{target:{value:'adelaide'}});
 expect(screen.getByRole('button',{name:'Confirmar inscrição'})).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Confirmar inscrição'}));
 expect(await screen.findByText('Inscrição registada')).toBeInTheDocument();
 expect(state.invoke).toHaveBeenCalledWith('social-initiatives',expect.objectContaining({body:expect.objectContaining({action:'register',payload:expect.objectContaining({consent:true,condominium_id:'adelaide'})})}));
});
it('retries invitation creation with the same idempotency key after a network error',async()=>{
 const requests:string[]=[];
 state.invoke.mockImplementation(async (_:string,{body}:{body:{action:string,payload:{request_id:string}}})=>{
  if(body.action==='catalog') return {data:catalog};
  if(body.action==='issue') { requests.push(body.payload.request_id); if(requests.length===1) return {error:new Error('network')}; return {data:{code:'ABCDEF0123456789'}}; }
  return {data:{...blank,address_valid:true,registration:{user_id:'user-one',condominium_id:'adelaide',is_public:false}}};
 });
 mount();
 fireEvent.click(await screen.findByRole('button',{name:'Criar convite'}));
 await screen.findByRole('alert');
 fireEvent.click(screen.getByRole('button',{name:'Criar convite'}));
 await waitFor(()=>expect(requests).toHaveLength(2));
 expect(requests[0]).toBe(requests[1]);
});
it('preserves a validated invitation through the login and registration links',async()=>{
 state.user=null;
 state.invoke.mockResolvedValue({data:catalog});
 mount('/feira-natalicia-talatona?convite=ABCDEF0123456789');
 const link=await screen.findByRole('link',{name:'Criar conta com este convite'});
 expect(link.getAttribute('href')).toContain('ref=ABCDEF0123456789&next=');
 expect(await screen.findByRole('link',{name:'Já tenho conta'})).toHaveAttribute('href','/login?next=%2Ffeira-natalicia-talatona%3Fconvite%3DABCDEF0123456789');
});
