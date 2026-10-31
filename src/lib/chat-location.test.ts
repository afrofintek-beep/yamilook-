import { describe, it, expect } from 'vitest';
import { parseChatLocation, locationMapUrl } from './chat-location';
describe('chat location', () => {
  it('reads existing coordinate messages and preserves references', () => {
    expect(parseChatLocation('Escritório\nPortão azul\n📍 https://www.google.com/maps?q=-8.93,13.18')).toEqual({ latitude: -8.93, longitude: 13.18, caption: 'Escritório\nPortão azul' });
  });
  it('rejects unsafe, malformed, out of range and ambiguous locations', () => {
    for (const value of [null, 'https://evil.example/maps?q=1,2', '📍 https://www.google.com/maps?q=91,2', '📍 https://www.google.com/maps?q=1,181', '📍 https://www.google.com/maps?q=1,2&evil=1', '📍 https://www.google.com/maps?q=1,2\n📍 https://www.google.com/maps?q=3,4']) expect(parseChatLocation(value)).toBeNull();
  });
  it('builds directions using only validated coordinates', () => {
    expect(locationMapUrl(parseChatLocation('📍 https://www.google.com/maps?q=0,0')!, true)).toBe('https://www.google.com/maps/dir/?api=1&destination=0,0');
  });
});
