import names from '@/i18n/country-names.json';

/** Bundled CLDR names work consistently even on browsers with limited locale data. */
export function localizedCountryName(code: string, language: string): string {
  const locale = language.toLowerCase().split(/[-_]/)[0] as keyof typeof names;
  const countries = names[locale] || names.pt;
  return countries[code as keyof typeof countries] || code;
}
