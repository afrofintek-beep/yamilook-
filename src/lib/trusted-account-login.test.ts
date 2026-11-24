import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '@supabase/supabase-js';
import { TrustedInvitationError } from '@/features/trusted-invites/api';
import {
  isTrustedPasswordValid,
  isValidLoginIdentifier,
  recoverTrustedAccount,
  signInWithIdentifier,
} from './trusted-account-login';

const mocks = vi.hoisted(() => ({ request: vi.fn(), passwordLogin: vi.fn(), setSession: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { signInWithPassword: mocks.passwordLogin, setSession: mocks.setSession },
} }));
vi.mock('@/features/trusted-invites/api', async original => ({
  ...await original<typeof import('@/features/trusted-invites/api')>(),
  trustedInvitationRequest: mocks.request,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.passwordLogin.mockResolvedValue({ error: null });
  mocks.setSession.mockResolvedValue({ error: null });
});

describe('trusted account sign-in', () => {
  it('keeps existing e-mail credentials on native Supabase Auth', async () => {
    const nativeError = new AuthError('Email not confirmed', 400);
    mocks.passwordLogin.mockResolvedValue({ error: nativeError });
    expect(await signInWithIdentifier('Person+business@example.com', 'ExistingPassword1')).toEqual({ error: nativeError });
    expect(mocks.passwordLogin).toHaveBeenCalledWith({ email: 'Person+business@example.com', password: 'ExistingPassword1' });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it('normalizes a trusted username and installs only the returned native session', async () => {
    mocks.request.mockResolvedValue({ ok: true, session: { access_token: 'access-one', refresh_token: 'refresh-one' } });
    expect(await signInWithIdentifier(' @Trusted_Person ', 'NewPassword123')).toEqual({ error: null });
    expect(mocks.request).toHaveBeenCalledWith('login', { username: 'trusted_person', password: 'NewPassword123' });
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: 'access-one', refresh_token: 'refresh-one' });
    expect(mocks.passwordLogin).not.toHaveBeenCalled();
  });

  it('does not claim successful login from an incomplete server response', async () => {
    mocks.request.mockResolvedValue({ ok: true, session: { access_token: 'access-one' } });
    const result = await signInWithIdentifier('trusted_person', 'NewPassword123');
    expect(result.error?.code).toBe('unavailable');
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it('keeps internal account identifiers out of user-facing credential errors', async () => {
    mocks.request.mockRejectedValue(new TrustedInvitationError('invalid_credentials', 'secret@trusted-login.yamilook.invalid'));
    const result = await signInWithIdentifier('@trusted_person', 'wrong-password');
    expect(result.error).toBeInstanceOf(AuthError);
    expect(result.error?.message).toBe('Invalid login credentials');
    expect(result.error?.code).toBe('invalid_credentials');
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it('retains the rate-limit status for localised feedback', async () => {
    mocks.request.mockRejectedValue(new TrustedInvitationError('rate_limited', 'wait'));
    expect((await signInWithIdentifier('trusted_person', 'NewPassword123')).error?.status).toBe(429);
  });

  it('accepts e-mail or bounded username while rejecting malformed identifiers', () => {
    for (const value of ['person@example.com', '@person_1', 'Abc', 'a'.repeat(20)]) expect(isValidLoginIdentifier(value)).toBe(true);
    for (const value of ['@@person', '_person', 'a'.repeat(21), 'person with spaces', 'ab', 'person@']) expect(isValidLoginIdentifier(value)).toBe(false);
  });
});

describe('trusted account recovery', () => {
  it('normalizes the saved code, sends the selected password and returns the rotated code without signing in', async () => {
    const oldCode = 'a'.repeat(64);
    const newCode = 'b'.repeat(64);
    mocks.request.mockResolvedValue({ ok: true, recovery_code: newCode, username: 'trusted_person' });
    expect(await recoverTrustedAccount('@Trusted_Person', oldCode.toUpperCase().match(/.{8}/g)!.join(' - '), 'NewPassword123')).toEqual({
      recovery_code: newCode, username: 'trusted_person',
    });
    expect(mocks.request).toHaveBeenCalledWith('recover', { username: 'trusted_person', recovery_code: oldCode, new_password: 'NewPassword123' });
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it('rejects malformed recovery details before submitting and rejects an incomplete response', async () => {
    await expect(recoverTrustedAccount('trusted_person', '123456', 'NewPassword123')).rejects.toMatchObject({ code: 'invalid_recovery' });
    expect(mocks.request).not.toHaveBeenCalled();
    mocks.request.mockResolvedValue({ ok: true });
    await expect(recoverTrustedAccount('trusted_person', 'a'.repeat(64), 'NewPassword123')).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('uses the agreed Unicode character minimum and UTF-8 byte maximum', () => {
    expect(isTrustedPasswordValid('NewPassword123')).toBe(true);
    expect(isTrustedPasswordValid('A1' + 'é'.repeat(5))).toBe(false);
    expect(isTrustedPasswordValid('Aa1' + 'é'.repeat(35))).toBe(false);
    expect(isTrustedPasswordValid('Aa1' + 'é'.repeat(10))).toBe(true);
    expect(isTrustedPasswordValid('onlylowercase123')).toBe(false);
  });
});
