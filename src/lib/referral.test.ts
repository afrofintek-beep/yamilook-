import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildInviteUrl } from './referral';

afterEach(() => vi.unstubAllGlobals());

describe('public invitation URLs', () => {
  it('does not expose Vercel preview URLs when creating a user invitation', () => {
    vi.stubGlobal('window', { location: { origin: 'https://yamilook-git-feature-example.vercel.app' } });
    expect(buildInviteUrl('A123456789ABCDEF')).toBe(
      'https://www.yamilook.com/register?ref=A123456789ABCDEF'
    );
  });

  it('uses the official domain without a referral code', () => {
    expect(buildInviteUrl(null)).toBe('https://www.yamilook.com/register');
  });

  it('encodes the referral query parameter', () => {
    expect(buildInviteUrl('ABCD+1234')).toBe('https://www.yamilook.com/register?ref=ABCD%2B1234');
  });
});
