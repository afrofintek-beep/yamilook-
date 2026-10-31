import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ admin: true, rpc: vi.fn() }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: state.admin, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc } }));
import AdminMentors from './AdminMentors';
let client: QueryClient;
beforeEach(() => {
  state.admin = true;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  state.rpc.mockReset().mockImplementation(async name => ({ data: name === 'academia_admin_mentors' ? [{ user_id: 'mentor', display_name: 'Ana', username: 'ana', specialty: 'Música', mentor_bio: 'Biografia completa', experience: 'Experiência completa', status: 'pending', is_verified_mentor: false, pending_sessions: 0 }] : { ok: true }, error: null }));
});
afterEach(() => { cleanup(); client.clear(); });
function mount() { return render(<QueryClientProvider client={client}><MemoryRouter><AdminMentors /></MemoryRouter></QueryClientProvider>); }
it('does not fetch mentor applications for a non-admin', () => {
 state.admin=false;mount();expect(screen.getByRole('alert')).toHaveTextContent('reservado');expect(state.rpc).not.toHaveBeenCalled();
});
it('requires a reason and sends an explicit approval only after confirmation', async () => {
 mount();fireEvent.click(await screen.findByRole('button',{name:'Aprovar'}));
 expect(screen.getByRole('button',{name:'Confirmar decisão'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Motivo da decisão'),{target:{value:'Experiência validada'}});
 fireEvent.click(screen.getByRole('button',{name:'Confirmar decisão'}));
 await waitFor(()=>expect(state.rpc).toHaveBeenCalledWith('academia_manage_mentor',{p_user:'mentor',p_action:'approve',p_reason:'Experiência validada'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('filters by username and lifecycle state without offering verification to a pending applicant', async () => {
 mount();await screen.findByRole('button',{name:'Aprovar'});expect(screen.queryByRole('button',{name:'Verificar para cobrar'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Pesquisar mentores'),{target:{value:'@ana'}});expect(screen.getByRole('button',{name:'Aprovar'})).toBeVisible();
 fireEvent.change(screen.getByLabelText('Filtrar estado'),{target:{value:'active'}});expect(screen.queryByRole('button',{name:'Aprovar'})).not.toBeInTheDocument();
});
it('shows retry when the server rejects loading applications', async () => {
 state.rpc.mockResolvedValue({data:null,error:new Error('not allowed')});mount();expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível');expect(screen.getByRole('button',{name:'Tentar novamente'})).toBeVisible();
});
