export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let prompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
let initialized = false;
export function captureAppInstallPrompt() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); prompt = event as InstallPrompt;
    listeners.forEach(listener => listener());
  });
  window.addEventListener('appinstalled', () => {
    prompt = null; listeners.forEach(listener => listener());
  });
}
export const getAppInstallPrompt = () => prompt;
export function clearAppInstallPrompt() { prompt = null; listeners.forEach(listener => listener()); }
export function subscribeAppInstall(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function isAppMode(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
