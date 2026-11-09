import { describe, expect, it } from 'vitest';
import { afrolocReference, njilaAddressUrl, parseChatAfroloc } from './chat-afroloc';

describe('AFROLOC to NJILA transport', () => {
  it('round trips opaque codes without guessing a grammar or adding coordinates', () => {
    const code = 'AO / loja & porta #2';
    const href = njilaAddressUrl(code)!;
    expect(new URL(href).searchParams.get('to')).toBe(code);
    expect(parseChatAfroloc(`Loja\n📍 ${href}`)).toEqual({ reference: code, caption: 'Loja' });
    expect(Array.from(new URL(href).searchParams.keys())).toEqual(['to']);
  });
  it('rejects control characters, bidi overrides, empty and oversized input', () => {
    for (const code of ['', ' ', 'A\nB', 'A\u202eB', 'x'.repeat(129)]) {
      expect(afrolocReference(code)).toBeNull();
      expect(njilaAddressUrl(code)).toBeNull();
    }
  });
  it('keeps untrusted, ambiguous and legacy locations as ordinary text', () => {
    for (const value of [null, '📍 https://evil.example/?to=A', '📍 https://www.njilamaps.com.evil.example/?to=A',
      '📍 https://user@www.njilamaps.com/?to=A', '📍 https://www.njilamaps.com/?to=A&to=B',
      '📍 https://www.njilamaps.com/?to=A#secret', '📍 https://www.njilamaps.com/?to=A&grant=secret',
      '📍 https://www.njilamaps.com/?to=%0AA%0AB', '📍 https://www.njilamaps.com/?to=',
      '📍 https://www.google.com/maps?q=1,2',
      '📍 https://www.njilamaps.com/?to=A\n📍 https://www.njilamaps.com/?to=B']) expect(parseChatAfroloc(value)).toBeNull();
  });
});
