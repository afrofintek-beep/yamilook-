import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ updateUser: vi.fn(), signInWithOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth } }));
import { normalizePhone, requestPhoneCode, confirmPhoneCode } from './api';

describe('phone access', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it.each([
    ['923 300 105', '+244923300105'], ['+244 923 828 282', '+244923828282'],
    ['00244 923 300 105', '+244923300105'], ['+351912345678', '+351912345678'],
    ['92330', null], ['user923300105', null], ['+000923300105', null], ['923300105 OR true', null],
  ])('normalizes %s safely', (input, expected) => expect(normalizePhone(input)).toBe(expected));
  it('does not create new accounts when logging in by SMS', async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null });
    await requestPhoneCode('923300105', 'login');
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ phone: '+244923300105', options: { shouldCreateUser: false } });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it('links only to the authenticated account, without admin confirmation', async () => {
    auth.updateUser.mockResolvedValue({ error: null });
    await requestPhoneCode('923300105', 'link');
    expect(auth.updateUser).toHaveBeenCalledWith({ phone: '+244923300105' });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
  it.each([['link','phone_change'],['login','sms']] as const)('verifies the right challenge for %s', async (mode, type) => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    await confirmPhoneCode('+244923300105', '123456', mode);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ phone: '+244923300105', token: '123456', type });
  });
  it('does not accept a failed or expired challenge', async () => {
    auth.verifyOtp.mockResolvedValue({ error: new Error('expired') });
    await expect(confirmPhoneCode('+244923300105', '123456', 'link')).rejects.toThrow('expired');
  });
  it('rejects malformed codes before contacting Auth', async () => {
    await expect(confirmPhoneCode('+244923300105', '123', 'link')).rejects.toThrow();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});
