import { describe, expect, it } from 'vitest';
import { walletRelyingParty } from './authorize';

describe('wallet relying party', () => {
  it.each([
    ['yamilook.com','yamilook.com'],
    ['www.yamilook.com','yamilook.com'],
    ['kosolola.com','kosolola.com'],
    ['www.kosolola.com','kosolola.com'],
  ])('maps %s to %s', (hostname, expected) => {
    expect(walletRelyingParty(hostname)).toBe(expected);
  });

  it('rejects an unapproved domain', () => {
    expect(() => walletRelyingParty('wallet.example.com')).toThrow('não está disponível');
  });
});
