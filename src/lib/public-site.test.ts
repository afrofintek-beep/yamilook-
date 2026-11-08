import { describe, expect, it, vi, afterEach } from 'vitest';
import { getYamilookPublicUrl, YAMILOOK_PUBLIC_ORIGIN, resolveYamilookPublicOrigin } from './public-site';

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

 describe('Explicit staging origin', () => {
  it('keeps the production default without configuration', () => {
    expect(resolveYamilookPublicOrigin()).toBe('https://www.yamilook.com');
  });
  it('uses the explicitly configured isolated deployment', () => {
    expect(resolveYamilookPublicOrigin('https://yamilook-invitations-staging.vercel.app/')).toBe('https://yamilook-invitations-staging.vercel.app');
  });
  it.each(['http://example.com','https://a:b@example.com','https://example.com/path','https://example.com/?token=1','https://example.com/#token'])('rejects unsafe or non-origin configuration: %s', (origin) => {
    expect(() => resolveYamilookPublicOrigin(origin)).toThrow();
  });
});
