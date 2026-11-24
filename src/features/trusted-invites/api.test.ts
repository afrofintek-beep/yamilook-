import { describe, expect, it, vi } from 'vitest';
import { buildTrustedInviteUrl, invitationState, readTrustedInvitationToken, trustedInvitationRequest, TrustedInvitationError } from './api';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
const token = 'ab'.repeat(32);

describe('trusted invitation transport', () => {
  it('keeps the bearer out of the URL query and retains the invitation language', () => {
    const url = new URL(buildTrustedInviteUrl(token, 'fr'));
    expect(url.origin).toBe('https://www.yamilook.com');
    expect(url.pathname).toBe('/convite-confianca');
    expect(url.search).toBe('?lang=fr');
    expect(readTrustedInvitationToken(url.hash)).toBe(token);
    expect(() => buildTrustedInviteUrl('guessable', 'pt')).toThrow();
    expect(readTrustedInvitationToken('#trusted=short')).toBeNull();
  });
  it('reads structured server errors from a failed Edge response', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ ok: false, error: { code: 'invalid_invitation', message: 'Unavailable' } }), { status: 400 }) } });
    await expect(trustedInvitationRequest('preview', { token })).rejects.toMatchObject({ name: 'TrustedInvitationError', code: 'invalid_invitation' });
    expect(invoke).toHaveBeenCalledWith('trusted-invitations', { body: { action: 'preview', token } });
  });
  it('fails closed for an empty success response', async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    await expect(trustedInvitationRequest('issue')).rejects.toBeInstanceOf(TrustedInvitationError);
  });
  it('shows used or cancelled records consistently after their expiry', () => {
    expect(invitationState({ status: 'pending', expires_at: '2020-01-01' })).toBe('expired');
    expect(invitationState({ status: 'used', expires_at: '2020-01-01' })).toBe('used');
    expect(invitationState({ status: 'pending', expires_at: '2099-01-01', revoked_at: '2026-01-01' })).toBe('revoked');
  });
});
