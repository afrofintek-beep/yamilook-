import { describe, expect, it, vi } from 'vitest';
import { verifyCertification, type VerificationPorts } from '../../../supabase/functions/afroloc-verify/verification';
const code = 'CD-KIN-EXAMPLE'; // Opaque test fixture, not an official address format.
function ports() {
  return {
    getUser: vi.fn().mockResolvedValue({ id: 'user', phone: '243812345678', phone_confirmed_at: '2026-10-25T00:00:00Z' }),
    getAddress: vi.fn().mockResolvedValue(code),
    lookup: vi.fn().mockResolvedValue({ ok: true, payload: { success: true, data: { certified: true, code } } }),
    save: vi.fn().mockResolvedValue(true),
  } satisfies VerificationPorts;
}
describe('AFROLOC ecosystem certification boundary', () => {
  it('uses the authenticated identity and preserves the authority-issued code', async () => {
    const p = ports();
    expect(await verifyCertification('token', p)).toEqual({ certified: true, code });
    expect(p.getUser).toHaveBeenCalledWith('token');
    expect(p.lookup).toHaveBeenCalledWith('+243812345678');
    expect(p.save).toHaveBeenCalledWith('user', code);
  });
  it.each([null, { id: 'user', phone: '+244923456789' }, { id: 'user', phone_number: '+244923456789', user_metadata: { phone_confirmed: true } }, { id: 'user', phone: '923', phone_confirmed_at: '2026-10-25' }])('rejects missing, unconfirmed or editable identity: %j', async user => {
    const p = ports(); p.getUser.mockResolvedValue(user);
    expect((await verifyCertification('token', p)).certified).toBe(false);
    expect(p.lookup).not.toHaveBeenCalled(); expect(p.save).not.toHaveBeenCalled();
  });
  it('requires a declared address before transmitting the phone', async () => {
    const p = ports(); p.getAddress.mockResolvedValue(null);
    expect(await verifyCertification('token', p)).toMatchObject({ reason: 'no_address' });
    expect(p.lookup).not.toHaveBeenCalled();
  });
  it.each([
    { ok: false, payload: { certified: true, code } },
    { ok: true, payload: { success: false, data: { certified: true, code } } },
    { ok: true, payload: null },
    { ok: true, payload: { certified: 'true', code } },
    { ok: true, payload: { certified: true } },
    { ok: true, payload: { certified: false, code } },
    { ok: true, payload: { certified: true, code: 'OTHER-ADDRESS' } },
  ])('does not certify from invalid or mismatched evidence: %j', async response => {
    const p = ports(); p.lookup.mockResolvedValue(response);
    expect((await verifyCertification('token', p)).certified).toBe(false);
    expect(p.save).not.toHaveBeenCalled();
  });
  it('does not report success after a failed write or concurrent address change', async () => {
    const p = ports(); p.save.mockResolvedValue(false);
    expect(await verifyCertification('token', p)).toEqual({ certified: false, reason: 'save_failed' });
  });
  it.each(['+244923456789', '+243812345678', '+242061234567'])('keeps international country codes: %s', async phone => {
    const p = ports(); p.getUser.mockResolvedValue({ id: 'user', phone, phone_confirmed_at: '2026-10-25' });
    await verifyCertification('token', p);
    expect(p.lookup).toHaveBeenCalledWith(phone);
  });
});
