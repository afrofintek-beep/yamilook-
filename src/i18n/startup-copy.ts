import { normalizeAppLanguage } from './afroloc-languages';
import { startupTranslations } from './startup-translations';

/** Recovery must work even if i18next, auth, or lazy route loading fails. */
export function loadingText(source: string): string {
  let language = 'pt';
  try {
    language = normalizeAppLanguage(new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('i18nextLng') || document.documentElement.lang || 'pt');
  } catch { /* Storage can be unavailable in a recovery screen. */ }
  return startupTranslations[language]?.[source] || source;
}
