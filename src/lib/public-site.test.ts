import { describe, expect, it, vi, afterEach } from 'vitest';
import { getYamilookPublicUrl, YAMILOOK_PUBLIC_ORIGIN } from './public-site';

afterEach(() => vi.unstubAllGlobals());

describe('YAMILOOK public URLs', () => {
  it('always uses the verified public domain even from a preview deployment', () => {
    vi.stubGlobal('window', { location: { origin: 'https://yamilook-git-feature-example.vercel.app' } });
    expect(YAMILOOK_PUBLIC_ORIGIN).toBe('https://www.yamilook.com');
    expect(getYamilookPublicUrl('/register')).toBe('https://www.yamilook.com/register');
    expect(getYamilookPublicUrl('/onboarding')).toBe('https://www.yamilook.com/onboarding');
    expect(getYamilookPublicUrl('/feed')).toBe('https://www.yamilook.com/feed');
    expect(getYamilookPublicUrl('/reset-password')).toBe('https://www.yamilook.com/reset-password');
  });
  it('rejects protocol-relative destinations', () => {
    expect(() => getYamilookPublicUrl('//untrusted.example')).toThrow('Expected an application path');
  });
});
