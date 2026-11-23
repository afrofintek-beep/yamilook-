import { normalizeAppLanguage } from '@/i18n/afroloc-languages';

export function registrationEmailLanguage(language: string | undefined): string {
  const locale = normalizeAppLanguage(language || 'pt');
  return locale === 'pt-banda' || locale === 'cjk' ? 'pt' : locale;
}
