import { expect, it } from 'vitest';
import { googleEntryUrl, parseGoogleEntry } from './google-entry';

it('accepts only a valid public coordinate pair as input', () => {
  expect(parseGoogleEntry(' -8.901, 13.201 ')).toEqual({ lat: -8.901, lon: 13.201 });
  expect(parseGoogleEntry(' -8.901, 181 ')).toBeNull();
  expect(parseGoogleEntry('https://example.invalid')).toBeNull();
});

it('uses only the separately issued entrance as the external destination', () => {
  const route = {
    status: 'ready' as const, entryPoint: { lat: -8.901, lon: 13.201 },
    expiresAt: new Date(2000).toISOString(), point: { lat: -8.9, lon: 13.2 },
  };
  const url = new URL(googleEntryUrl(route, 1000)!);
  expect(url.origin).toBe('https://www.google.com');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    api: '1', destination: '-8.901,13.201', dir_action: 'navigate',
  });
  expect(googleEntryUrl(route, 2000)).toBeNull();
  expect(googleEntryUrl({ status: 'denied' }, 1000)).toBeNull();
  expect(googleEntryUrl({ ...route, entryPoint: { lat: 91, lon: 0 } }, 1000)).toBeNull();
});
