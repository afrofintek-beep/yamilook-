import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('./api',()=>({locaccess:api.call,validHandle:()=>true}));
vi.mock('./AccessMap',()=>({AccessMap:({approximate}:{approximate?:boolean})=><div>{approximate?'Área aproximada':'Ponto exacto'}</div>}));
import AccessVisit from './AccessVisit';
beforeEach(()=>{vi.useFakeTimers();api.call.mockReset();Object.defineProperty(navigator,'onLine',{configurable:true,value:true});Object.defineProperty(document,'hidden',{configurable:true,value:false})});
afterEach(()=>{cleanup();vi.useRealTimers()});
const show=async()=>{await act(async()=>render(<MemoryRouter initialEntries={['/afroloc/acesso/test']}><Routes><Route path="/afroloc/acesso/:handle" element={<AccessVisit/>}/></Routes></MemoryRouter>))};
it('removes a disclosed point when permission is revoked',async()=>{
 api.call.mockResolvedValueOnce({status:'ready',point:{lat:-8.9,lon:13.2},expiresAt:new Date(Date.now()+20000).toISOString()}).mockResolvedValue({status:'denied'});
 await show();expect(screen.getByText('Ponto exacto')).toBeVisible();await act(async()=>vi.advanceTimersByTimeAsync(5000));expect(screen.queryByText('Ponto exacto')).toBeNull();
});
it('expires the point even when renewal hangs and hides it while offline',async()=>{
 api.call.mockResolvedValueOnce({status:'ready',point:{lat:-8.9,lon:13.2},expiresAt:new Date(Date.now()+20000).toISOString()}).mockImplementation(()=>new Promise(()=>{}));
 await show();await act(async()=>vi.advanceTimersByTimeAsync(20001));expect(screen.queryByText('Ponto exacto')).toBeNull();
});
it('only requests device location after the recipient chooses to activate it',async()=>{
 const watch=vi.fn().mockReturnValue(1),clear=vi.fn();Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition:watch,clearWatch:clear}});
 api.call.mockResolvedValue({status:'proximity',radius:250,area:{lat:-8.9,lon:13.2}});await show();expect(watch).not.toHaveBeenCalled();expect(screen.queryByText('Ponto exacto')).toBeNull();
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Activar localização e verificar proximidade'})));expect(watch).toHaveBeenCalledOnce();
 await act(async()=>window.dispatchEvent(new Event('offline')));expect(screen.queryByText('Área aproximada')).toBeNull();cleanup();expect(clear).toHaveBeenCalledWith(1);
});
it('checks authorization again before opening Google Maps',async()=>{
 api.call.mockResolvedValueOnce({status:'proximity',radius:250,area:{lat:-8.9,lon:13.2},hasExternalRoute:true})
  .mockResolvedValueOnce({status:'denied'});
 const navigate=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 try {
  await show();
  fireEvent.click(screen.getByText('Formas de lá chegar'));
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Google Maps'})));
  expect(api.call).toHaveBeenLastCalledWith('external_route',{handle:'test'});
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('O percurso no Google Maps já não está disponível');
 } finally {
  navigate.mockRestore();
 }
});
