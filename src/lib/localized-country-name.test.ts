import { expect, it } from 'vitest';
import { AFRICAN_LOCATIONS } from './african-locations';
import { localizedCountryName } from './localized-country-name';
import names from '@/i18n/country-names.json';
it('covers every residence country in all ten languages', () => {
  for (const language of Object.keys(names)) {
    for (const country of AFRICAN_LOCATIONS) {
      expect(localizedCountryName(country.countryCode, language)).not.toBe(country.countryCode);
    }
  }
});
it('uses the selected language including Portuguese informal and regional variants', () => {
  expect(localizedCountryName('MZ', 'pt')).toBe('Moçambique');
  expect(localizedCountryName('ZA', 'pt-banda')).toBe('África do Sul');
  expect(localizedCountryName('ZA', 'fr-FR')).toBe('Afrique du Sud');
  expect(localizedCountryName('ZA', 'ar')).toBe('جنوب أفريقيا');
  expect(localizedCountryName('ZA', 'zu')).toBe('iNingizimu Afrika');
});
