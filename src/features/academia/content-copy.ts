import type { Json } from '@/integrations/supabase/types';
import { uiLocale } from '@/i18n/ui-copy';

/** Stored translations are bound to the exact source so edits cannot display stale copy. */
export function academiaContent(
  source: string | null | undefined,
  entry: Json | undefined,
  locale = uiLocale(),
): string {
  if (!source) return '';
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || entry.source !== source) return source;

  const values = entry.values;
  if (!values || typeof values !== 'object' || Array.isArray(values) || !Object.prototype.hasOwnProperty.call(values, locale)) return source;

  const translated = values[locale];
  return typeof translated === 'string' && translated.trim() ? translated : source;
}
