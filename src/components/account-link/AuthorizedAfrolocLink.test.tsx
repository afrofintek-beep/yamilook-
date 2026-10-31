import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import AuthorizedAfrolocLink from './AuthorizedAfrolocLink';
const {subscribe,invoke,getUser,single}=vi.hoisted(()=>({subscribe:vi.fn(),invoke:vi.fn(),getUser:vi.fn(),single:vi.fn()}));
vi.mock('./AccountPhoneConfirmation',()=>({default:()=>null}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{onAuthStateChange:subscribe,getUser},functions:{invoke},from:()=>({select:()=>({eq:()=>({single})})})}}));
afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.resetAllMocks();});
it('disabled integration has no UI or authentication subscription',()=>{
 vi.stubEnv('VITE_ACCOUNT_LINK_V1_ENABLED','false');
 const {container}=render(<AuthorizedAfrolocLink/>);
 expect(container).toBeEmptyDOMElement();expect(subscribe).not.toHaveBeenCalled();
});
it('completing AFROLOC authorization displays the linked account and clears the one-use request',async()=>{
 vi.stubEnv('VITE_ACCOUNT_LINK_V1_ENABLED','true');
 subscribe.mockReturnValue({data:{subscription:{unsubscribe:vi.fn()}}});
 getUser.mockResolvedValue({data:{user:{id:'local'}}});single.mockResolvedValue({data:{afroloc_code:'AO-TEST'}});
 invoke.mockImplementation(async(_name,{body})=>({data:body.action==='list'?{ok:true,links:[]}:body.action==='begin'?{ok:true,request_id:'request',account_reference:'local',authorization_url:'https://www.afroloc.ao/account-link#request=request'}:{ok:true,certified:true,expires_at:'2026-12-01T00:00:00Z'}}));
 render(<AuthorizedAfrolocLink/>);
 fireEvent.click(screen.getByText('Carregar endereço e ligações'));
 await screen.findByText('AO-TEST');
 await waitFor(()=>expect(screen.getByRole('checkbox')).not.toBeDisabled());
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByText('Pedir ligação'));
 expect(await screen.findByRole('link',{name:'Autorizar no AFROLOC'})).toHaveAttribute('href','https://www.afroloc.ao/account-link#request=request');
 fireEvent.click(screen.getByText('Concluir após autorizar'));
 await screen.findByText('AO-TEST — Ligada');
 expect(screen.queryByText('Concluir após autorizar')).not.toBeInTheDocument();
 expect(screen.getByRole('checkbox')).not.toBeChecked();
});
