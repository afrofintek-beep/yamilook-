import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PublicProfile from './PublicProfile';
const { rpc, request }=vi.hoisted(()=>({rpc:vi.fn(),request:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc}}));
const profile={id:'author',username:'tony_dinguanza',display_name:'Tony',created_at:'2026-01-01',afroloc_certified:false,is_creator:false};
beforeEach(()=>{vi.resetAllMocks();rpc.mockImplementation(()=>({abortSignal:request}));request.mockResolvedValue({data:profile,error:null});});
afterEach(cleanup);
function mount(path='/u/tony_dinguanza'){return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/u/:username" element={<PublicProfile/>}/></Routes></MemoryRouter>);}
it('renders public profile with a normalized lookup value',async()=>{
  mount('/u/%20tony_dinguanza%20');expect(await screen.findByRole('heading',{name:'Tony'})).toBeInTheDocument();expect(rpc).toHaveBeenCalledWith('get_public_profile',{p_username:'tony_dinguanza'});
});
it('reserves not-found for a successful empty response',async()=>{
  request.mockResolvedValue({data:null,error:null});mount();expect(await screen.findByText('Perfil não encontrado.')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Tentar novamente'})).not.toBeInTheDocument();
});
it('shows a retry action for backend errors and recovers after retry',async()=>{
  request.mockResolvedValueOnce({data:null,error:{message:'Connection failed'}});mount();expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');expect(screen.queryByText('Perfil não encontrado.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));expect(await screen.findByRole('heading',{name:'Tony'})).toBeInTheDocument();expect(request).toHaveBeenCalledTimes(2);
});
it('handles rejected network requests',async()=>{
  request.mockRejectedValue(new Error('Offline'));mount();expect(await screen.findByRole('alert')).toHaveTextContent('Verifica a ligação');
});
it('aborts the request when the page is left',()=>{
  request.mockReturnValue(new Promise(()=>{}));const {unmount}=mount();const signal=request.mock.calls[0][0];unmount();expect(signal.aborted).toBe(true);
});
