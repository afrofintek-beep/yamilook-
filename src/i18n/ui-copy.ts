import { useTranslation } from 'react-i18next';
import i18n from './index';
import { normalizeAppLanguage } from './afroloc-languages';

const isAngolaFair = () => typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/feira-natalicia-talatona';

/** Translate application-authored copy only. Never pass user messages or profile fields here. */
export function uiText(source: string, values?: Record<string, string | number>): string {
  return i18n.t(source, {
    ns: 'interface', keySeparator: false, nsSeparator: false,
    defaultValue: source, ...values, ...(isAngolaFair() ? { lng: 'pt' } : {}),
  }) as string;
}

export function uiLocale(): string {
  if (isAngolaFair()) return 'pt';
  return normalizeAppLanguage(i18n.resolvedLanguage || i18n.language || 'pt');
}

/** Subscribe before early returns without remounting forms, calls or media. */
export function useUiLocale(): string {
  const { i18n: instance } = useTranslation('interface');
  if (isAngolaFair()) return 'pt';
  return normalizeAppLanguage(instance.resolvedLanguage || instance.language || 'pt');
}
