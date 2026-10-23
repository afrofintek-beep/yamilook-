/** Repair only the selected application's shell, never sessions or message data. */
export async function recoverApplicationAssets(scope: '/' | '/papos-app/'): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(reg => reg.scope === new URL(scope, window.location.origin).href).map(reg => reg.unregister()));
  }
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.filter(name => scope === '/papos-app/' ? name.startsWith('papos-app-assets-') : name.startsWith('workbox-') || name.startsWith('yamilook-')).map(name => caches.delete(name)));
  }
}
