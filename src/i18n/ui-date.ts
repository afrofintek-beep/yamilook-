import { format as formatPattern, type FormatOptions } from 'date-fns';
import { uiLocale, uiText } from './ui-copy';

/** Localize human-readable dates; keep numeric machine/form patterns unchanged. */
export function format(date: Date | number | string, pattern: string, options?: FormatOptions): string {
  if (!/MMM|EEE|PPP/.test(pattern)) return formatPattern(date, pattern, options);
  const settings: Intl.DateTimeFormatOptions = {};
  if (/d|PPP/.test(pattern)) settings.day = 'numeric';
  if (/MMM|PPP/.test(pattern)) settings.month = /MMMM|PPP/.test(pattern) ? 'long' : 'short';
  if (/y|PPP/.test(pattern)) settings.year = 'numeric';
  if (/EEE/.test(pattern)) settings.weekday = pattern.includes('EEEE') ? 'long' : 'short';
  if (/H|h/.test(pattern)) { settings.hour = '2-digit'; settings.minute = '2-digit'; }
  return new Intl.DateTimeFormat(uiLocale(), settings).format(new Date(date));
}

/** Browser Intl supplies the selected language for all ten supported locales. */
export function formatDistanceToNow(date: Date | number | string, options?: { addSuffix?: boolean; locale?: unknown; includeSeconds?: boolean }): string {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000;
  const absolute = Math.abs(seconds);
  let unit: Intl.RelativeTimeFormatUnit = 'second', divisor = 1;
  for (const [candidate, size] of [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]] as const) {
    if (absolute >= size) { unit = candidate; divisor = size; break; }
  }
  const value = Math.round(seconds / divisor);
  if (['ln', 'yo', 'sn'].includes(uiLocale())) return translatedDistance(unit, value, !!options?.addSuffix);
  if (options?.addSuffix) return new Intl.RelativeTimeFormat(uiLocale(), { numeric: 'auto' }).format(value, unit);
  return new Intl.NumberFormat(uiLocale(), { style: 'unit', unit, unitDisplay: 'long' }).format(Math.abs(value));
}

// ICU has only numeric relative-time fallbacks for these three languages.
function translatedDistance(unit: Intl.RelativeTimeFormatUnit, value: number, suffix: boolean): string {
  const count = Math.abs(value);
  if (suffix && count === 0) return uiText('agora');
  switch (unit) {
    case 'second':
      if (suffix && value < 0) return count === 1 ? uiText('há {{count}} segundo', { count }) : uiText('há {{count}} segundos', { count });
      if (suffix) return count === 1 ? uiText('daqui a {{count}} segundo', { count }) : uiText('daqui a {{count}} segundos', { count });
      return count === 1 ? uiText('{{count}} segundo', { count }) : uiText('{{count}} segundos', { count });
    case 'minute':
      if (suffix && value < 0) return count === 1 ? uiText('há {{count}} minuto', { count }) : uiText('há {{count}} minutos', { count });
      if (suffix) return count === 1 ? uiText('daqui a {{count}} minuto', { count }) : uiText('daqui a {{count}} minutos', { count });
      return count === 1 ? uiText('{{count}} minuto', { count }) : uiText('{{count}} minutos', { count });
    case 'hour':
      if (suffix && value < 0) return count === 1 ? uiText('há {{count}} hora', { count }) : uiText('há {{count}} horas', { count });
      if (suffix) return count === 1 ? uiText('daqui a {{count}} hora', { count }) : uiText('daqui a {{count}} horas', { count });
      return count === 1 ? uiText('{{count}} hora', { count }) : uiText('{{count}} horas', { count });
    case 'day':
      if (suffix && value < 0) return count === 1 ? uiText('há {{count}} dia', { count }) : uiText('há {{count}} dias', { count });
      if (suffix) return count === 1 ? uiText('daqui a {{count}} dia', { count }) : uiText('daqui a {{count}} dias', { count });
      return count === 1 ? uiText('{{count}} dia', { count }) : uiText('{{count}} dias', { count });
    case 'month':
      if (suffix && value < 0) return count === 1 ? uiText('há {{count}} mês', { count }) : uiText('há {{count}} meses', { count });
      if (suffix) return count === 1 ? uiText('daqui a {{count}} mês', { count }) : uiText('daqui a {{count}} meses', { count });
      return count === 1 ? uiText('{{count}} mês', { count }) : uiText('{{count}} meses', { count });
    case 'year':
      if (suffix && value < 0) return count === 1 ? uiText('há {{count}} ano', { count }) : uiText('há {{count}} anos', { count });
      if (suffix) return count === 1 ? uiText('daqui a {{count}} ano', { count }) : uiText('daqui a {{count}} anos', { count });
      return count === 1 ? uiText('{{count}} ano', { count }) : uiText('{{count}} anos', { count });
    default: return String(count);
  }
}
