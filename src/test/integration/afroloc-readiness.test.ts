import { describe, it, expect, vi } from 'vitest';
import { handleVerificationRequest } from '../../../supabase/functions/afroloc-verify/handler';
const request = (body: unknown, token = 'valid') => new Request('https://example.test', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
describe('deployed AFROLOC readiness boundary', () => {
  it('rejects invalid authorization before inspecting consent', async () => {
    const res = await handleVerificationRequest(request({ consent: true, code: 'TEST' }), async () => null);
    expect(res.status).toBe(401);
  });
  it.each([null, {}, { consent: 'true', code: 'TEST' }, { consent: true, code: '' }])('requires explicit consent and address: %j', async body => {
    const res = await handleVerificationRequest(request(body), async () => ({ id: 'self' }));
    expect(res.status).toBe(400);
  });
  it('never grants certification even with valid identity and consent', async () => {
    const res = await handleVerificationRequest(request({ consent: true, code: 'TEST', user_id: 'someone-else', certified: true }), async () => ({ id: 'self' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ certified: false, reason: 'integration_pending' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
  it('redacts infrastructure errors', async () => {
    const res = await handleVerificationRequest(request({}), async () => { throw new Error('secret'); });
    expect(res.status).toBe(503); expect(await res.text()).not.toContain('secret');
  });
  it('rejects unsupported methods without accessing Auth', async () => {
    const auth = vi.fn(); const res = await handleVerificationRequest(new Request('https://example.test'), auth);
    expect(res.status).toBe(405); expect(auth).not.toHaveBeenCalled();
  });
});
