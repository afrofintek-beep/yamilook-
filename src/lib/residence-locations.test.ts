import { expect, it } from 'vitest';
import { RESIDENCE_COUNTRY_CODES, loadResidenceCities, matchingResidenceCities } from './residence-locations';
import { localizedCountryName } from './localized-country-name';

it('covers current countries and territories in all ten languages without retired country codes', () => {
  expect(RESIDENCE_COUNTRY_CODES).toHaveLength(250);
  expect(RESIDENCE_COUNTRY_CODES).toContain('PT');
  expect(RESIDENCE_COUNTRY_CODES).toContain('BR');
  expect(RESIDENCE_COUNTRY_CODES).not.toContain('AN');
  expect(RESIDENCE_COUNTRY_CODES).not.toContain('CS');
  for (const language of ['pt','en','fr','ar','am','sw','ln','yo','sn','zu']) {
    for (const code of RESIDENCE_COUNTRY_CODES) expect(localizedCountryName(code,language)).not.toBe(code);
  }
});
it('expands African localities while preserving existing neighborhood-compatible city names', async () => {
  const angola = await loadResidenceCities('AO');
  expect(angola.length).toBeGreaterThan(500);
  for (const name of ['Luanda','Benguela','Huambo','Menongue','Sumbe','Caxito','Saurimo','Luena','Ondjiva','Lubango']) expect(angola).toContain(name);
  expect(new Set(angola).size).toBe(angola.length);
  expect(await loadResidenceCities('MZ')).toContain('Maputo');
});
it('loads all regional catalogs and permits countries without populated-place suggestions', async () => {
  for (const [country,city] of [['PT','Lisbon'],['BR','Brasília'],['US','New York City'],['JP','Tokyo'],['AU','Sydney']]) {
    expect(await loadResidenceCities(country)).toContain(city);
  }
  expect(await loadResidenceCities('AQ')).toBeInstanceOf(Array);
});
it('finds accented place names with unaccented input and limits native suggestions', () => {
  expect(matchingResidenceCities(['São Paulo','Saurimo'],'sao','pt')).toEqual(['São Paulo']);
  expect(matchingResidenceCities(Array.from({length:100},(_,i)=>`City ${i}`),'city','en')).toHaveLength(50);
});
