import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({access:{googleMaps:false,maguela:false,loading:false},session:vi.fn(),invoke:vi.fn(),authChange:vi.fn(),unsubscribe:vi.fn()}));
vi.mock('@/features/integration-access/useIntegrationAccess',()=>({useIntegrationAccess:()=>state.access}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getSession:state.session,onAuthStateChange:state.authChange},functions:{invoke:state.invoke}}}));
import MaguelaIdentityManagement from './MaguelaIdentityManagement';
beforeEach(()=>{
 Object.assign(state.access,{googleMaps:false,maguela:false,loading:false});
 vi.stubEnv('VITE_MAGUELA_IDENTITY_MANAGEMENT_ENABLED','true');
 state.session.mockReset().mockResolvedValue({data:{session:{access_token:'test-session'}},error:null});
 state.invoke.mockReset().mockResolvedValue({data:{ok:true,linked:true},error:null});
 state.unsubscribe.mockReset();state.authChange.mockReset().mockReturnValue({data:{subscription:{unsubscribe:state.unsubscribe}}});
});
afterEach(()=>{cleanup();vi.unstubAllEnvs();});

it.each([false,true])('hides account association management without verified access (loading=%s)',loading=>{
 Object.assign(state.access,{maguela:loading,loading});
 const view=render(<MaguelaIdentityManagement/>);
 expect(view.container).toBeEmptyDOMElement();
 expect(state.authChange).not.toHaveBeenCalled();expect(state.session).not.toHaveBeenCalled();expect(state.invoke).not.toHaveBeenCalled();
});

it('allows an authorized account to consult an enabled association',async()=>{
 state.access.maguela=true;render(<MaguelaIdentityManagement/>);
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Consultar associação MAGUELA'})));
 expect(state.invoke).toHaveBeenCalledWith('maguela-identity-bridge',{headers:{Authorization:'Bearer test-session'},body:{action:'status'}});
 expect(screen.getByRole('status')).toHaveTextContent('Associação activa');
});

it('does not invoke the bridge if permission is withdrawn while obtaining the session',async()=>{
 state.access.maguela=true;
 let finish!:(value:unknown)=>void;state.session.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
 const view=render(<MaguelaIdentityManagement/>);
 fireEvent.click(screen.getByRole('button',{name:'Consultar associação MAGUELA'}));
 state.access.maguela=false;view.rerender(<MaguelaIdentityManagement/>);
 await act(async()=>finish({data:{session:{access_token:'test-session'}},error:null}));
 expect(state.invoke).not.toHaveBeenCalled();expect(state.unsubscribe).toHaveBeenCalledOnce();
 expect(view.container).toBeEmptyDOMElement();
});

it('dismisses a pending revoke confirmation when access is withdrawn',()=>{
 state.access.maguela=true;const view=render(<MaguelaIdentityManagement/>);
 fireEvent.click(screen.getByRole('button',{name:'Revogar associação MAGUELA'}));
 expect(screen.getByText('Confirma a revogação da associação e dos códigos pendentes?')).toBeVisible();
 state.access.maguela=false;view.rerender(<MaguelaIdentityManagement/>);
 state.access.maguela=true;view.rerender(<MaguelaIdentityManagement/>);
 expect(screen.queryByText('Confirma a revogação da associação e dos códigos pendentes?')).toBeNull();
 expect(state.invoke).not.toHaveBeenCalled();
});

it('preserves the deployment flag even for an authorized account',()=>{
 state.access.maguela=true;vi.stubEnv('VITE_MAGUELA_IDENTITY_MANAGEMENT_ENABLED','false');
 const view=render(<MaguelaIdentityManagement/>);expect(view.container).toBeEmptyDOMElement();
 expect(state.authChange).not.toHaveBeenCalled();
});
