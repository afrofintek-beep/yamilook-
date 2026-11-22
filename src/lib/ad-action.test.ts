import { describe, expect, it } from 'vitest';
import type { Advertisement } from '@/hooks/useAdvertising';
import { resolveAdAction } from './ad-action';

const ad = (cta_url: string, business?: Advertisement['business']) => ({ cta_url, business } as Advertisement);

describe('advertisement destinations', () => {
  it.each([
    'javascript:void(0)',
    'data:text/html,<p>untrusted</p>',
    'file:///tmp/report.pdf',
    'ftp://example.com/file',
    'https://trusted.example@other.example/',
    'https://example.com/\npath',
  ])('does not open an unsafe advertised URL: %s', value => {
    expect(resolveAdAction(ad(value)).kind).toBe('none');
  });

  it('accepts a bare business domain and a domain with a port', () => {
    expect(resolveAdAction(ad('www.example.ao/menu')).href).toBe('https://www.example.ao/menu');
    expect(resolveAdAction(ad('example.ao:8443/menu')).href).toBe('https://example.ao:8443/menu');
  });

  it('uses the validated business website when the advertisement URL is unsafe', () => {
    expect(resolveAdAction(ad('javascript:void(0)', { website: 'https://example.ao/menu' })).href).toBe('https://example.ao/menu');
  });

  it('keeps the Angolan phone fallback when no valid web address exists', () => {
    expect(resolveAdAction(ad('data:text/html,blocked', { phone: '923 456 789' }))).toMatchObject({ kind: 'whatsapp', href: 'https://wa.me/244923456789' });
  });
});
