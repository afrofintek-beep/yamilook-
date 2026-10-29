import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ getSession: vi.fn(), refresh: vi.fn(), invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: state.getSession, refreshSession: state.refresh }, functions: { invoke: state.invoke } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'learner' } }) }));
import { requestLearningAction } from './useAcademiaLearning';
beforeEach(() => {
  vi.clearAllMocks(); state.getSession.mockResolvedValue({ data: { session: { access_token: 'caller', expires_at: Date.now() / 1000 + 1000 } } });
  state.invoke.mockResolvedValue({ data: { id: 'goal' }, error: null }); state.refresh.mockResolvedValue({ data: { session: { access_token: 'fresh' } } });
});
it('sends the caller token and the requested action to the Edge API', async () => {
  expect(await requestLearningAction({ action: 'create', payload: { title: 'Objetivo' } })).toBe('goal');
  expect(state.invoke).toHaveBeenCalledWith('academia-learning', { headers: { Authorization: 'Bearer caller' }, body: { action: 'create', payload: { title: 'Objetivo' } } });
});
it('refreshes a rejected token only once', async () => {
  state.invoke.mockResolvedValueOnce({ error: { context: { status: 401 } } });
  await requestLearningAction({ action: 'complete', goalId: 'goal' });
  expect(state.refresh).toHaveBeenCalledOnce(); expect(state.invoke).toHaveBeenCalledTimes(2);
  expect(state.invoke.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
});
it('does not retry authorization failures and shows the server explanation', async () => {
  state.invoke.mockResolvedValue({ error: { context: { status: 403, json: async () => ({ error: 'Apenas o mentor pode avaliar.' }) } } });
  await expect(requestLearningAction({ action: 'review' })).rejects.toThrow('Apenas o mentor');
  expect(state.refresh).not.toHaveBeenCalled(); expect(state.invoke).toHaveBeenCalledOnce();
});
it('does not claim success when the server did not confirm a saved result', async () => {
  state.invoke.mockResolvedValue({ data: {}, error: null });
  await expect(requestLearningAction({ action: 'create' })).rejects.toThrow('confirmar');
});
