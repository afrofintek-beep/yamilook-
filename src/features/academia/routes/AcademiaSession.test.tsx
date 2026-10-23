import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'mentor'}})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('../hooks/useAcademia',()=>({useSubmitAcademiaReview:()=>({mutate:vi.fn()})}));
vi.mock('../components/ReviewModal',()=>({ReviewModal:()=>null}));
vi.mock('@tanstack/react-query',()=>({
  useQuery:({queryKey}:any)=>({data:queryKey[0]==='academia-session'?{id:'session',title:'Teste',mentorId:'mentor',mentorName:'Mentor',scheduledAt:new Date(Date.now()+86400000).toISOString(),status:'scheduled',spots:1,spotsLeft:1,date:'24 outubro',time:'18:00',format:'1:1'}:null,isLoading:false}),
  useMutation:()=>({mutate:vi.fn(),isPending:false}),useQueryClient:()=>({invalidateQueries:vi.fn()})
}));
import AcademiaSession from './AcademiaSession';
afterEach(cleanup);
it('exits to Academia even when the previous history entry is the video room',()=>{
  render(<MemoryRouter initialEntries={['/academia','/academia/live/session','/academia/session']}><Routes>
    <Route path="/academia" element={<p>Lista da Academia</p>}/>
    <Route path="/academia/live/:sessionId" element={<p>Sala de vídeo</p>}/>
    <Route path="/academia/:sessionId" element={<AcademiaSession />}/>
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Voltar à Academia'}));
  expect(screen.getByText('Lista da Academia')).toBeVisible();
  expect(screen.queryByText('Sala de vídeo')).not.toBeInTheDocument();
});
