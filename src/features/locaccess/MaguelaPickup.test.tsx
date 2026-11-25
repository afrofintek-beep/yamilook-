import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({access:{googleMaps:false,maguela:false,loading:false},pickup:vi.fn()}));
vi.mock('@/features/integration-access/useIntegrationAccess',()=>({useIntegrationAccess:()=>state.access}));
vi.mock('./maguela-pickup',()=>({maguelaPickup:state.pickup,validPickupReference:(value:string)=>/^[A-Za-z0-9._-]+$/.test(value)}));
import {MaguelaPickupControl,MaguelaPickupVisit} from './MaguelaPickup';
const controls=()=> <><MaguelaPickupControl handle="address" grantId="grant" disabled={false}/><MaguelaPickupVisit handle="address"/></>;
beforeEach(()=>{Object.assign(state.access,{googleMaps:false,maguela:false,loading:false});state.pickup.mockReset().mockResolvedValue({status:'denied'});Object.defineProperty(navigator,'onLine',{configurable:true,value:true});Object.defineProperty(document,'hidden',{configurable:true,value:false});});
afterEach(cleanup);

it.each([false,true])('does not show or request MAGUELA pickup data without verified access (loading=%s)',loading=>{
 Object.assign(state.access,{googleMaps:true,maguela:loading,loading});
 const view=render(controls());
 expect(view.container).toBeEmptyDOMElement();
 expect(state.pickup).not.toHaveBeenCalled();
});

it('loads pickup controls for an authorized account and removes them when authorization is withdrawn',async()=>{
 state.access.maguela=true;
 state.pickup.mockResolvedValue({status:'designated',reference:'AO-PUBLIC-GATE'});
 const view=render(controls());
 await act(async()=>{});
 expect(screen.getByText('Ponto de recolha MAGUELA')).toBeVisible();
 expect(screen.getByText('Recolha MAGUELA')).toBeVisible();
 expect(state.pickup).toHaveBeenCalledWith('owner_status',{handle:'address',grant_id:'grant'});
 state.access.maguela=false;view.rerender(controls());
 expect(view.container).toBeEmptyDOMElement();
 expect(state.pickup).toHaveBeenCalledTimes(1);
});

it('discards a pending pickup resolution after authorization is withdrawn',async()=>{
 state.access.maguela=true;
 let finish!:(value:unknown)=>void;
 state.pickup.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
 const view=render(<MaguelaPickupVisit handle="address"/>);
 fireEvent.click(screen.getByRole('button',{name:'Consultar ponto de recolha'}));
 state.access.maguela=false;view.rerender(<MaguelaPickupVisit handle="address"/>);
 await act(async()=>finish({status:'ready',reference:'AO-PUBLIC-GATE',expiresAt:new Date(Date.now()+20000).toISOString()}));
 expect(view.container).toBeEmptyDOMElement();
 state.access.maguela=true;view.rerender(<MaguelaPickupVisit handle="address"/>);
 expect(screen.queryByRole('link',{name:'Abrir MAGUELA'})).toBeNull();
 expect(screen.queryByText('AO-PUBLIC-GATE')).toBeNull();
 expect(screen.getByRole('button',{name:'Consultar ponto de recolha'})).toBeEnabled();
});
