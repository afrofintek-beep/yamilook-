import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({user:'me',profile:{id:'me',display_name:'Titular',username:'titular',avatar_url:null,phone_number:'923123456',email:'titular@example.invalid',country_code:'AO',city:'Luanda',neighborhood:'Centro',afroloc_code:'AO-LDA-ING-000-DIG-G10-35Q1-N23WC',afroloc_certification_status:'pending'},saved:[] as {id:string;code:string;label:string;status:string;created_at:string;expires_at:string}[],fail:false,share:vi.fn().mockResolvedValue('shared')}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:state.user}})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({select:()=>({eq:()=>({single:async()=>({data:{...state.profile},error:state.fail?new Error('offline'):null})})})}),rpc:async()=>({data:null,error:null}),functions:{invoke:async()=>({data:{addresses:state.saved},error:null})}}}));
vi.mock('./export',()=>({cardImage:async()=>new Blob(['PNG'],{type:'image/png'}),shareCard:state.share,downloadCard:vi.fn()}));
import CurrentAfrolocCard from './CurrentAfrolocCard';
beforeEach(()=>{state.saved=[];state.fail=false;state.profile.afroloc_code='AO-LDA-ING-000-DIG-G10-35Q1-N23WC';state.user='me';state.share.mockClear()});
afterEach(cleanup);
async function updateCard(){
 fireEvent.keyDown(screen.getByRole('button',{name:'Opções do cartão'}),{key:'Enter'});
 const item=await screen.findByRole('menuitem',{name:'Actualizar cartão'});
 await act(async()=>fireEvent.click(item));
}

it('shares only the reviewed contact fields and fetches the current code again',async()=>{
 render(<MemoryRouter><CurrentAfrolocCard/></MemoryRouter>);await waitFor(()=>expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Partilhar cartão'}));await waitFor(()=>expect(state.share).toHaveBeenCalledOnce());
 expect(state.share.mock.calls[0][1]).not.toContain(state.profile.email);expect(state.share.mock.calls[0][1]).not.toContain(state.profile.phone_number);
 fireEvent.click(screen.getByText('Dados a incluir na partilha',{selector:'summary'}));
 fireEvent.click(screen.getByRole('checkbox',{name:'Telefone'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Partilhar cartão'}));await waitFor(()=>expect(state.share).toHaveBeenCalledTimes(2));expect(state.share.mock.calls[1][1]).toContain(state.profile.phone_number);
 state.profile.afroloc_code='AO-ZU-G10-NEW-CODE';await updateCard();
 await waitFor(()=>expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeEnabled());expect(screen.getByRole('img').getAttribute('aria-label')).toContain('AO-ZU-G10-NEW-CODE');
 state.fail=true;await updateCard();expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeDisabled();
});
it('drops the previous owner card on account changes',async()=>{
 const view=render(<MemoryRouter><CurrentAfrolocCard/></MemoryRouter>);await waitFor(()=>expect(screen.getByRole('img')).toBeVisible());state.user='other';state.fail=true;view.rerender(<MemoryRouter><CurrentAfrolocCard/></MemoryRouter>);await waitFor(()=>expect(screen.queryByRole('img')).toBeNull());
});

it('opens the card of the clicked address instead of a different residence',async()=>{
 state.saved=[{id:'saved-address',code:'AO-ZU-G10-ABC-DEF',label:'Casa',status:'pending',created_at:'2026-01-01',expires_at:'2099-01-01'}];
 render(<MemoryRouter initialEntries={[{pathname:'/afroloc/cartao',state:{afrolocAddressId:'saved-address'}}]}><CurrentAfrolocCard/></MemoryRouter>);
 await waitFor(()=>expect(screen.getByRole('img').getAttribute('aria-label')).toContain('AO-ZU-G10-ABC-DEF'));
 expect(screen.getByRole('combobox')).toHaveValue('saved-address');
});
it('prefers the base residence card when the clicked address has the same code',async()=>{
 state.saved=[{id:'saved-address',code:state.profile.afroloc_code,label:'Casa',status:'pending',created_at:'2026-01-01',expires_at:'2099-01-01'}];
 render(<MemoryRouter initialEntries={[{pathname:'/afroloc/cartao',state:{afrolocAddressId:'saved-address'}}]}><CurrentAfrolocCard/></MemoryRouter>);
 await waitFor(()=>expect(screen.getByRole('img')).toBeVisible());expect(screen.getByRole('combobox')).toHaveValue('residence');expect(screen.getByRole('link',{name:'Ver no mapa'})).toHaveAttribute('href','/afroloc/enderecos');
});
it('does not substitute a different card when the requested address is unavailable',async()=>{
 render(<MemoryRouter initialEntries={[{pathname:'/afroloc/cartao',state:{afrolocAddressId:'not-owned'}}]}><CurrentAfrolocCard/></MemoryRouter>);
 await screen.findByText(/O cartão deste endereço não está disponível/);expect(screen.queryByRole('img')).toBeNull();
});

it('places the card and primary actions before collapsed details and management',async()=>{
 const {container}=render(<MemoryRouter><CurrentAfrolocCard/></MemoryRouter>);
 const card=await screen.findByRole('img');
 expect(card.compareDocumentPosition(screen.getByRole('button',{name:'Partilhar cartão'}))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.getByRole('link',{name:'Ver no mapa'})).toHaveAttribute('href',expect.stringContaining('njilamaps.com'));
 for(const panel of container.querySelectorAll('details'))expect(panel.open).toBe(false);
 expect(screen.queryByRole('menuitem',{name:'Guardar imagem'})).toBeNull();
 expect(screen.getByRole('link',{name:'Adicionar ou gerir endereços'})).toHaveAttribute('href','/afroloc/enderecos');
});
