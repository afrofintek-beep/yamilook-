// AFROLOC LanguageSelector.tsx, blob 6ab336302de90402aea953aafd2200618445b492.
// Keep the ecosystem list independent from Yamilook's legacy tone options.
export const afrolocLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'ln', name: 'Lingala', nativeName: 'Lingála' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'sn', name: 'Shona', nativeName: 'ChiShona' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
  { code: 'kmb', name: 'Kimbundu', nativeName: 'Kimbundu' },
  { code: 'umb', name: 'Umbundu', nativeName: 'Umbundu' },
  { code: 'kg', name: 'Kikongo', nativeName: 'Kikongo' },
];
export function normalizeAppLanguage(value: string) {
  const code = value.toLowerCase();
  if (code === 'pt-banda') return code;
  const base = code.split('-')[0];
  return [...afrolocLanguages.map(l => l.code), 'cjk'].includes(base) ? base : 'pt';
}
