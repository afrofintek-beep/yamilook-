/** Approved regional onboarding photographs; other languages keep their existing images. */
const regionalLanguages = new Set(['pt', 'en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu']);
const scenes = new Set(['identity', 'birthday', 'welcome', 'avatar', 'bio', 'chat', 'calls', 'groups', 'stories']);

export function onboardingImage(language: string | undefined, scene: string, fallback: string): string {
  const locale = language?.toLowerCase().split(/[-_]/)[0];
  return locale && regionalLanguages.has(locale) && scenes.has(scene)
    ? `/onboarding/${locale}/${scene}.webp`
    : fallback;
}
