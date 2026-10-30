import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MvpCandidatesManager } from './MvpCandidatesManager';
import { LiveSessionsManager } from './LiveSessionsManager';
import { TopicSuggestionsManager } from './TopicSuggestionsManager';
const mock = vi.hoisted(() => ({ fail: true }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
 const q: Record<string, unknown> = {};
 for (const method of ['select', 'eq', 'in', 'order']) q[method] = () => q;
 q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mock.fail ? null : [], error: mock.fail ? { message: 'offline' } : null }).then(resolve);
 return q;
} } }));
afterEach(() => { cleanup(); mock.fail = true; });
describe('admin loading states', () => {
 for (const [Component, empty] of [[MvpCandidatesManager, 'Nenhum candidato encontrado'], [LiveSessionsManager, 'Nenhuma sessão em direto'], [TopicSuggestionsManager, 'Nenhuma sugestão pendente']] as const) {
  it(`${empty}: errors are not empty results, retry recovers`, async () => {
   render(<Component />);
   expect(await screen.findByRole('alert')).toBeInTheDocument();
   expect(screen.queryByText(empty)).not.toBeInTheDocument();
   mock.fail = false;
   fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
   await waitFor(() => expect(screen.getByText(empty)).toBeInTheDocument());
   expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
 }
});
