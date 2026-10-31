import { afrolocLanguages, normalizeAppLanguage } from './afroloc-languages';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Only load Portuguese (default) synchronously, others will be lazy-loaded
import pt from './locales/pt.json';

export const languages = [...afrolocLanguages,
  { code: 'pt-banda', name: 'Yamilook da Banda', nativeName: 'Yamilook da Banda' },
  { code: 'cjk', name: 'Tchokwe', nativeName: 'Tchokwe' },
];

// Load banda overrides for urban tone
const loadBandaOverrides = async (): Promise<Record<string, unknown>> => {
  const bandaModule = await import('./locales/pt-banda.json');
  return bandaModule.default;
};

// Deep merge helper for translation objects
const deepMerge = (base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> => {
  const result = { ...base };
  for (const key of Object.keys(overrides)) {
    if (
      typeof overrides[key] === 'object' &&
      overrides[key] !== null &&
      !Array.isArray(overrides[key]) &&
      typeof result[key] === 'object' &&
      result[key] !== null
    ) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, overrides[key] as Record<string, unknown>);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
};

// Lazy load language resources
const loadLanguage = async (lng: string): Promise<{ translation: Record<string, unknown> }> => {
  // Handle banda variant
  if (lng === 'pt-banda' || lng === 'pt-BANDA') {
    const bandaOverrides = await loadBandaOverrides();
    return { translation: deepMerge(pt as Record<string, unknown>, bandaOverrides) };
  }

  switch (normalizeAppLanguage(lng)) {
    case 'yo':
      return { translation: (await import('./locales/yo.json')).default };
    case 'sn':
      return { translation: (await import('./locales/sn.json')).default };
    case 'zu':
      return { translation: (await import('./locales/zu.json')).default };
    case 'en':
      return { translation: (await import('./locales/en.json')).default };
    case 'kmb':
      return { translation: (await import('./locales/kmb.json')).default };
    case 'umb':
      return { translation: (await import('./locales/umb.json')).default };
    case 'kg':
      return { translation: (await import('./locales/kg.json')).default };
    case 'cjk':
      return { translation: (await import('./locales/cjk.json')).default };
    case 'fr':
      return { translation: (await import('./locales/fr.json')).default };
    case 'ln':
      return { translation: (await import('./locales/ln.json')).default };
    case 'sw':
      return { translation: (await import('./locales/sw.json')).default };
    case 'am':
      return { translation: (await import('./locales/am.json')).default };
    case 'ar':
      return { translation: (await import('./locales/ar.json')).default };
    default:
      return { translation: pt };
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
    },
    fallbackLng: { yo: ['en', 'pt'], sn: ['en', 'pt'], zu: ['en', 'pt'], default: ['pt'] },
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;

// Load before changing so the first render uses the requested translations.
let languageRequest = 0;
export async function changeAppLanguage(language: string) {
  const request = ++languageRequest;
  const code = normalizeAppLanguage(language);
  if (['yo', 'sn', 'zu'].includes(code) && !i18n.hasResourceBundle('en', 'translation')) {
    i18n.addResourceBundle('en', 'translation', (await loadLanguage('en')).translation);
  }
  if (!i18n.hasResourceBundle(code, 'translation')) {
    i18n.addResourceBundle(code, 'translation', (await loadLanguage(code)).translation);
  }
  if (request === languageRequest) await i18n.changeLanguage(code);
}
function syncDocumentLanguage(language: string) {
  const code = normalizeAppLanguage(language);
  document.documentElement.lang = code;
  document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
}
i18n.on('languageChanged', (language) => {
  syncDocumentLanguage(language);
  // Existing Yamilook settings also call i18next directly.
  if (!i18n.hasResourceBundle(language, 'translation')) {
    void changeAppLanguage(language).catch(() => { /* Keep the available fallback. */ });
  }
});
void changeAppLanguage(i18n.language || 'pt').then(() => syncDocumentLanguage(i18n.language)).catch(() => { /* Portuguese remains available offline. */ });
