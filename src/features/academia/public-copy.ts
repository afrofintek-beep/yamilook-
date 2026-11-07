import type { TFunction } from 'i18next';
import pt from '@/i18n/locales/pt.json';
import type { Community } from './hooks/useAcademiaCommunity';

/** Translate the shipped catalogue, while preserving later editorial changes. */
export function localizeCommunity(community: Community, t: TFunction): Community {
  const catalog = pt.academiaPublic.catalog;
  const original = catalog[community.slug as keyof typeof catalog];
  if (!original) return community;
  const translated = { ...community };
  for (const field of ['title', 'description', 'starter_title', 'starter_instructions', 'starter_skill'] as const) {
    if (community[field] === original[field]) {
      translated[field] = t(`academiaPublic.catalog.${community.slug}.${field}`, { defaultValue: community[field] });
    }
  }
  return translated;
}
