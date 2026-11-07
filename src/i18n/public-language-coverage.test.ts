import { describe, expect, it } from 'vitest';
import { appLanguages, normalizeAppLanguage } from './afroloc-languages';
import { entryTranslations } from './entry-translations';

const locales = import.meta.glob('./locales/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>;
function flatten(object: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(object).flatMap(([key, value]) => typeof value === 'object' && value !== null
    ? Object.entries(flatten(value as Record<string, unknown>, `${prefix}${key}.`))
    : [[`${prefix}${key}`, value as string]]));
}
const sections = ['auth.', 'common.', 'nav.', 'publicAuth.', 'onboardingFlow.', 'academiaPublic.'];
const source = Object.entries(flatten(locales['./locales/pt.json'])).filter(([key]) => sections.some(section => key.startsWith(section)));
const placeholders = (text: string) => [...text.matchAll(/{{\s*([^}]+)\s*}}/g)].map(match => match[1].trim()).sort();

describe('ten-language public entry rollout', () => {
  it('keeps the three deferred languages out of every public language list', () => {
    expect(appLanguages.map(language => language.code)).toEqual(['en', 'fr', 'pt', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu']);
    expect(Object.keys(entryTranslations).sort()).toEqual(appLanguages.map(language => language.code).sort());
    for (const code of ['kmb', 'umb', 'kg', 'KMB-AO', 'umb-AO', 'kg-CD']) expect(normalizeAppLanguage(code)).toBe('pt');
  });

  for (const { code } of appLanguages) {
    it(`contains every public-entry key and preserves variables in ${code}`, () => {
      const translated = flatten(locales[`./locales/${code}.json`]);
      for (const [key, original] of source) {
        expect(translated[key], key).toBeTypeOf('string');
        expect(translated[key].trim(), key).not.toBe('');
        expect(placeholders(translated[key]), key).toEqual(placeholders(original));
      }
    });
  }
});
