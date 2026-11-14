import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({user:'me',profile:{id:'me',display_name:'Titular',username:'titular',avatar_url:null,phone_number:'923123456',email:'titular@example.invalid',country_code:'AO',city:'Luanda',neighborhood:'Centro',afroloc_code:'AO-LDA-ING-000-DIG-G10-35Q1-N23WC',afroloc_certification_status:'pending'},fail:false,share:vi.fn().mockResolvedValue('shared')}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:state.user}})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({select:()=>({eq:()=>({single:async()=>({data:{...state.profile},error:state.fail?new Error('offline'):null})})})}),rpc:async()=>({data:null,error:null}),functions:{invoke:async()=>({data:{addresses:[]},error:null})}}}));
vi.mock('./export',()=>({cardImage:async()=>new Blob(['PNG'],{type:'image/png'}),shareCard:state.share,downloadCard:vi.fn()}));
import CurrentAfrolocCard from './CurrentAfrolocCard';
beforeEach(()=>{state.fail=false;state.profile.afroloc_code='AO-LDA-ING-000-DIG-G10-35Q1-N23WC';state.user='me';state.share.mockClear()});
afterEach(cleanup);
it('shares only the reviewed contact fields and fetches the current code again',async()=>{
 render(<MemoryRouter><CurrentAfrolocCard/></MemoryRouter>);await waitFor(()=>expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Partilhar cartão'}));await waitFor(()=>expect(state.share).toHaveBeenCalledOnce());
 expect(state.share.mock.calls[0][1]).not.toContain(state.profile.email);expect(state.share.mock.calls[0][1]).not.toContain(state.profile.phone_number);
 fireEvent.click(screen.getByRole('checkbox',{name:'Telefone'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Partilhar cartão'}));await waitFor(()=>expect(state.share).toHaveBeenCalledTimes(2));expect(state.share.mock.calls[1][1]).toContain(state.profile.phone_number);
 state.profile.afroloc_code='AO-ZU-G10-NEW-CODE';await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Actualizar cartão'})));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeEnabled());expect(screen.getByRole('img').getAttribute('aria-label')).toContain('AO-ZU-G10-NEW-CODE');
 state.fail=true;await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Actualizar cartão'})));expect(screen.getByRole('button',{name:'Partilhar cartão'})).toBeDisabled();
});
it('drops the previous owner card on account changes',async()=>{
 const view=render(<MemoryRouter><CurrentAfrolocCard/></MemoryRouter>);await waitFor(()=>expect(screen.getByRole('img')).toBeVisible());state.user='other';state.fail=true;view.rerender(<MemoryRouter><CurrentAfrolocCard/></MemoryRouter>);await waitFor(()=>expect(screen.queryByRole('img')).toBeNull());
});
