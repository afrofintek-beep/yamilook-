import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme } from './theme';
afterEach(() => {
  document.documentElement.removeAttribute('data-brand');
  document.documentElement.classList.remove('dark');
  document.head.querySelector('meta[name="theme-color"]')?.remove();
  localStorage.removeItem('yamilook-theme');
});
describe('Application brand theme isolation', () => {
  it.each(['light', 'dark'] as const)('keeps KOSOLOLA chrome teal in %s mode', mode => {
    document.documentElement.dataset.brand = 'kosolola';
    const meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta);
    applyTheme(mode);
    expect(meta.content).toBe('#006568');
    expect(document.documentElement.classList.contains('dark')).toBe(mode === 'dark');
  });
  it('preserves Yamilook browser colours outside the independent app', () => {
    const meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta);
    applyTheme('light'); expect(meta.content).toBe('#FBF9F5');
    applyTheme('dark'); expect(meta.content).toBe('#121214');
  });
});
