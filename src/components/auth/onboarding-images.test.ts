import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { onboardingImage } from './onboarding-images';

describe('regional onboarding images', () => {
  it('resolves every approved scene to a shipped asset', () => {
    for (const language of ['ar', 'am', 'zu']) {
      for (const scene of ['identity', 'birthday', 'welcome', 'avatar', 'bio', 'chat', 'calls', 'groups', 'stories']) {
        const path = onboardingImage(language, scene, 'fallback');
        expect(path).toBe(`/onboarding/${language}/${scene}.webp`);
        expect(existsSync(`public${path}`)).toBe(true);
      }
    }
  });
  it('supports regional language variants', () => {
    expect(onboardingImage('AR-MA', 'welcome', 'fallback')).toBe('/onboarding/ar/welcome.webp');
    expect(onboardingImage('zu_ZA', 'avatar', 'fallback')).toBe('/onboarding/zu/avatar.webp');
  });
  it('preserves existing images for other languages and unknown scenes', () => {
    for (const language of ['pt', 'pt-banda', 'en', 'fr', undefined]) {
      expect(onboardingImage(language, 'welcome', 'fallback')).toBe('fallback');
    }
    expect(onboardingImage('ar', 'unknown', 'fallback')).toBe('fallback');
  });
});
