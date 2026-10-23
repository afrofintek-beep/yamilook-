import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({when:'',error:''}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'mentor'}})}));
vi.mock('@tanstack/react-query',()=>({useQuery:()=>({data:{id:'session',title:'Teste',mentor_id:'mentor',scheduled_at:fixture.when,status:'scheduled'},isLoading:false,refetch:vi.fn(),dataUpdatedAt:Date.now()})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{signOut:vi.fn()}}}));
vi.mock('../hooks/useAcademiaVideo',()=>({requestAcademiaVideo:vi.fn(),useAcademiaVideo:()=>({room:null,participants:[],connection:'disconnected',loading:false,error:fixture.error,messages:[],leave:vi.fn(),join:vi.fn()})}));
import AcademiaLiveRoom from './AcademiaLiveRoom';
const draw=()=>render(<MemoryRouter initialEntries={['/academia/live/session']}><Routes><Route path="/academia/live/:sessionId" element={<AcademiaLiveRoom />} /></Routes></MemoryRouter>);
beforeEach(()=>{fixture.when=new Date(Date.now()+24*60*60*1000).toISOString();fixture.error='';});
afterEach(cleanup);
it('shows opening time and disables a session scheduled for tomorrow',()=>{
  draw();expect(screen.getByRole('button',{name:'Iniciar / entrar'})).toBeDisabled();
  expect(screen.getByText(/Esta sala abre em/)).toBeVisible();
});
it('allows the mentor to enter within the fifteen-minute window',()=>{
  fixture.when=new Date(Date.now()+10*60*1000).toISOString();draw();
  expect(screen.getByRole('button',{name:'Iniciar / entrar'})).toBeEnabled();
});
it('offers sign-in recovery for an expired session',()=>{
  fixture.error='A tua sessão expirou. Inicia sessão novamente.';draw();
  expect(screen.getByRole('button',{name:'Entrar novamente'})).toBeVisible();
});
