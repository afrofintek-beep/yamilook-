import { beforeEach, expect, it, vi } from 'vitest';
import { handleLearningRequest } from '../../../supabase/functions/academia-learning/handler';
const user = vi.fn(), rpc = vi.fn();
const createDatabase = vi.fn(() => ({ auth: { getUser: user }, rpc }));
const request = (body: unknown, token = 'Bearer test') => new Request('https://example.invalid', { method: 'POST', headers: token ? { Authorization: token } : {}, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); user.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null }); rpc.mockResolvedValue({ data: 'goal-id', error: null }); });
it('authenticates before processing a write and never uses a service role', async () => {
  expect((await handleLearningRequest(request({ action: 'create' }, ''), createDatabase)).status).toBe(401);
  expect(createDatabase).not.toHaveBeenCalled();
  user.mockResolvedValue({ data: { user: null }, error: new Error('revoked') });
  expect((await handleLearningRequest(request({ action: 'create' }), createDatabase)).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it.each([{}, [], null, { action: 'approve' }, { action: 'review', goalId: 'bad' }, { action: 'create', payload: [] }])('rejects malformed input %j', async body => {
  expect((await handleLearningRequest(request(body), createDatabase)).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it('bounds request size and rejects malformed JSON', async () => {
  expect((await handleLearningRequest(request({ action: 'create', payload: { text: 'x'.repeat(16000) } }), createDatabase)).status).toBe(413);
  expect((await handleLearningRequest(new Request('https://example.invalid', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: '{' }), createDatabase)).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it('passes only the API arguments using the verified caller token', async () => {
  const response = await handleLearningRequest(request({ action: 'create', goalId: 'ignored', actor_id: 'forged', payload: { title: 'Objetivo' } }), createDatabase);
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ id: 'goal-id' });
  expect(createDatabase).toHaveBeenCalledWith('Bearer test');
  expect(rpc).toHaveBeenCalledWith('academia_learning_action', { p_action: 'create', p_goal: null, p_payload: { title: 'Objetivo' } });
});
it('returns authorization failures without exposing database internals', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Não tens acesso.' } });
  expect((await handleLearningRequest(request({ action: 'create' }), createDatabase)).status).toBe(403);
  rpc.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'Internal schema and constraint' } });
  const response = await handleLearningRequest(request({ action: 'create' }), createDatabase);
  expect(response.status).toBe(400); expect(JSON.stringify(await response.json())).not.toContain('Internal');
});
