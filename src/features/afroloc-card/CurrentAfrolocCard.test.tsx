import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({user:'me',profile:{id:'me',display_name:'Titular',username:'titular',avatar_url:null,phone_number:'923123456',email:'titular@example.invalid',country_code:'AO',city:'Luanda',neighborhood:'Centro',afroloc_code:'AO-LDA-ING-000-DIG-G10-35Q1-N23WC',afroloc_certification_status:'pending'},saved:[] as {id:string;code:string;label:string;status:string;created_at:string;expires_at:string}[],postal:null as null|{status:'ready';kind:'example'|'linked';reference:string},fail:false,share:vi.fn().mockResolvedValue('shared')}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:state.user}})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({select:()=>({eq:()=>({single:async()=>({data:{...state.profile},error:state.fail?new Error('offline'):null})})})}),rpc:async(name:string)=>({data:name==='locaccess_action'?{handle:'00000000-0000-4000-8000-000000000001',enabled:false,grants:[]}:null,error:null}),functions:{invoke:async()=>({data:{addresses:state.saved},error:null})}}}));
vi.mock('./usePostalCard',()=>({usePostalCard:()=>({value:state.postal,error:false,busy:false})}));
vi.mock('./export',()=>({cardImage:async()=>new Blob(['PNG'],{type:'image/png'}),shareCard:state.share,downloadCard:vi.fn()}));
import CurrentAfrolocCard from './CurrentAfrolocCard';
beforeEach(()=>{state.saved=[];state.postal=null;state.fail=false;state.profile.afroloc_code='AO-LDA-ING-000-DIG-G10-35Q1-N23WC';state.user='me';state.share.mockClear()});
afterEach(cleanup);
async function updateCard(){
 fireEvent.keyDown(screen.getByRole('button',{name:'Opções do cartão'}),{key:'Enter'});
 const item=await screen.findByRole('menuitem',{name:'Actualizar cartão'});
 await act(async()=>fireEvent.click(item));
}

it('shares only the reviewed contact fields and fetches the current code again',async()=>{
 render(<MemoryRouter><CurrentAfrolocCard/></MemoryRouter>);await waitFor(()=>expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Partilhar cartão'}));await waitFor(()=>expect(state.share).toHaveBeenCalledOnce());
 expect(state.share.mock.calls[0][1]).not.toContain(state.profile.afroloc_code);expect(state.share.mock.calls[0][1]).not.toContain(state.profile.neighborhood);expect(state.share.mock.calls[0][1]).toContain('/afroloc/acesso/');expect(state.share.mock.calls[0][1]).not.toContain(state.profile.email);expect(state.share.mock.calls[0][1]).not.toContain(state.profile.phone_number);
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
 expect(screen.getByRole('combobox',{name:'Endereço'})).toHaveValue('saved-address');
});
it('prefers the base residence card when the clicked address has the same code',async()=>{
 state.saved=[{id:'saved-address',code:state.profile.afroloc_code,label:'Casa',status:'pending',created_at:'2026-01-01',expires_at:'2099-01-01'}];
 render(<MemoryRouter initialEntries={[{pathname:'/afroloc/cartao',state:{afrolocAddressId:'saved-address'}}]}><CurrentAfrolocCard/></MemoryRouter>);
 await waitFor(()=>expect(screen.getByRole('img')).toBeVisible());expect(screen.getByRole('combobox',{name:'Endereço'})).toHaveValue('residence');expect(screen.getByRole('button',{name:'Ver no mapa'})).toBeEnabled();
});
it('does not substitute a different card when the requested address is unavailable',async()=>{
 render(<MemoryRouter initialEntries={[{pathname:'/afroloc/cartao',state:{afrolocAddressId:'not-owned'}}]}><CurrentAfrolocCard/></MemoryRouter>);
 await screen.findByText(/O cartão deste endereço não está disponível/);expect(screen.queryByRole('img')).toBeNull();
});

it('places the card and primary actions before collapsed details and management',async()=>{
 const {container}=render(<MemoryRouter><CurrentAfrolocCard/></MemoryRouter>);
 const card=await screen.findByRole('img');
 expect(card.compareDocumentPosition(screen.getByRole('button',{name:'Partilhar cartão'}))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 await waitFor(()=>expect(screen.getByRole('button',{name:'Ver no mapa'})).toBeEnabled());
 expect(container.querySelector('section[aria-label="Cartão AFROLOC"] a')).toHaveAttribute('href',expect.stringContaining('/afroloc/acesso/'));
 for(const panel of container.querySelectorAll('details'))expect(panel.open).toBe(false);
 expect(screen.queryByRole('menuitem',{name:'Guardar imagem'})).toBeNull();
 expect(screen.getByRole('link',{name:'Adicionar ou gerir endereços'})).toHaveAttribute('href','/afroloc/enderecos');
});

it('keeps the postal example and its qualification together on screen and in exported text',async()=>{
 state.postal={status:'ready',kind:'example',reference:'5051500-10000'};
 const {container}=render(<MemoryRouter><CurrentAfrolocCard/></MemoryRouter>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeEnabled());
 const cards=container.querySelectorAll('svg[role="img"][aria-label]');expect(cards).toHaveLength(2);
 for(const card of cards){expect(card.textContent).toContain('Cx. Postal*');expect(card.textContent).toContain('5051500-10000');expect(card.textContent).toContain('Exemplo');expect(card.textContent?.replace(/\s/g,'')).toContain('Nãocorrespondeaumacaixaatribuída');}
 fireEvent.click(screen.getByRole('button',{name:'Partilhar cartão'}));await waitFor(()=>expect(state.share).toHaveBeenCalledOnce());
 const text=state.share.mock.calls[0][1];expect(text).toContain('Cx. Postal*');expect(text).toContain('5051500-10000');expect(text).toContain('Não corresponde a uma caixa atribuída');expect(text).not.toContain(state.profile.afroloc_code);
});

it('omits deselected address fields from both card images and share text, and can restore them',async()=>{
 state.postal={status:'ready',kind:'example',reference:'5051500-10000'};
 const {container}=render(<MemoryRouter><CurrentAfrolocCard/></MemoryRouter>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeEnabled());
 fireEvent.click(screen.getByText('Detalhes do endereço',{selector:'summary'}));
 for(const name of ['País','Província','Município','Bairro / zona','Cx. Postal*','Tipo de endereço','Código AFROLOC'])fireEvent.click(screen.getByRole('checkbox',{name,exact:true}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeEnabled());
 for(const card of container.querySelectorAll('svg[role="img"][aria-label]')){
  for(const value of ['Angola','Luanda','Ingombota','Centro','5051500-10000','Residência principal',state.profile.afroloc_code,'Exemplo ilustrativo'])expect(card.textContent).not.toContain(value);
  expect(card.textContent).toContain('Titular');
 }
 fireEvent.click(screen.getByRole('button',{name:'Partilhar cartão'}));await waitFor(()=>expect(state.share).toHaveBeenCalledOnce());
 const text=state.share.mock.calls[0][1];expect(text).not.toContain('Angola');expect(text).not.toContain('5051500-10000');expect(text).toContain('/afroloc/acesso/');
 fireEvent.click(screen.getByRole('checkbox',{name:'Cx. Postal*',exact:true}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeEnabled());
 for(const card of container.querySelectorAll('svg[role="img"][aria-label]')){expect(card.textContent).toContain('5051500-10000');expect(card.textContent).toContain('Exemplo ilustrativo');expect(card.textContent).not.toContain('Angola');}
});
