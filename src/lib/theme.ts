// Single source of truth for applying the light/dark theme.
// The <html> element carries the `.dark` class in dark mode (Tailwind darkMode:'class').
// The choice is mirrored to localStorage so index.html can apply it before first
// paint (no flash); the DB copy (user settings) is the cross-device source.

export type ThemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'yamilook-theme';

export function resolveDark(theme: ThemePref): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(theme: ThemePref): void {
  if (typeof document === 'undefined') return;
  const dark = resolveDark(theme);
  document.documentElement.classList.toggle('dark', dark);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', document.documentElement.dataset.brand === 'kosolola' ? '#006568' : dark ? '#121214' : '#FBF9F5');
}
