import {act,cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
const invoke=vi.hoisted(()=>vi.fn());
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'owner'},profile:{country_code:'AO'}})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke}}}));
vi.mock('@/i18n/ui-copy',()=>({useUiLocale:()=> 'pt',uiText:(value:string)=>value}));
import AfrolocExperience from './AfrolocExperience';
const Card=()=>{const location=useLocation();return <p>Selected: {location.state?.afrolocAddressId}</p>};
afterEach(()=>{cleanup();invoke.mockClear()});
it('opens the owned-card screen only for a message from the embedded AFROLOC window',async()=>{
 render(<MemoryRouter initialEntries={['/afroloc']}><Routes><Route path="/afroloc" element={<AfrolocExperience/>}/><Route path="/afroloc/cartao" element={<Card/>}/></Routes></MemoryRouter>);
 const frame=screen.getByTitle('O meu endereço AFROLOC') as HTMLIFrameElement;
 const data={type:'yamilook-afroloc-request',id:'click',action:'open-card',data:{id:'saved-address'}};
 await act(async()=>{window.dispatchEvent(new MessageEvent('message',{origin:'https://other.example',source:frame.contentWindow,data}));window.dispatchEvent(new MessageEvent('message',{origin:'https://app.afroloc.ao',source:window,data}))});
 expect(screen.getByTitle('O meu endereço AFROLOC')).toBeInTheDocument();
 await act(async()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://app.afroloc.ao',source:frame.contentWindow,data})));
 expect(screen.getByText('Selected: saved-address')).toBeInTheDocument();expect(invoke).not.toHaveBeenCalled();
});

it('carries the interface language and avoids a duplicate address-back control',()=>{
 render(<MemoryRouter><AfrolocExperience/></MemoryRouter>);
 const frame=screen.getByTitle('O meu endereço AFROLOC');
 expect(frame.getAttribute('src')).toBe('https://app.afroloc.ao/experiencia/yamilook/?lang=pt');
 expect(screen.queryByRole('button',{name:'Voltar aos endereços'})).toBeNull();
 expect(screen.getByRole('link',{name:/Voltar à Yamilook/})).toBeVisible();
});
it.each([true,false])('opens a requested map only after its ID appears in the authorised list (owned=%s)',async owned=>{
 invoke.mockResolvedValue({data:{addresses:owned?[{id:'saved-address'}]:[]},error:null});
 render(<MemoryRouter initialEntries={[{pathname:'/afroloc/enderecos',state:{afrolocMapAddressId:'saved-address'}}]}><AfrolocExperience/></MemoryRouter>);
 const frame=screen.getByTitle('O meu endereço AFROLOC') as HTMLIFrameElement;
 const post=vi.spyOn(frame.contentWindow!,'postMessage');
 await act(async()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://app.afroloc.ao',source:frame.contentWindow,data:{type:'yamilook-afroloc-request',id:'list',action:'list',data:{}}})));
 const navigation=post.mock.calls.filter(([message])=>message.type==='yamilook-afroloc-navigation');
 expect(navigation.length).toBe(owned?1:0);
 if(owned)expect(navigation[0]).toEqual([{type:'yamilook-afroloc-navigation',action:'map',id:'saved-address'},'https://app.afroloc.ao']);
});
