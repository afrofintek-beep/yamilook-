// Vite emits the original rejection before React sees a failed lazy import.
// Keep only its identity: never retain exception text or asset URLs.
const preloadErrors = new WeakSet<object>();

export function trackAssetLoadErrors(target: Window = window) {
  const onError = (event: Event) => {
    const error = (event as Event & { payload?: unknown }).payload;
    if (error && typeof error === 'object') preloadErrors.add(error);
    // Do not preventDefault: React must still receive the rejection.
  };
  target.addEventListener('vite:preloadError', onError);
  return () => target.removeEventListener('vite:preloadError', onError);
}

export function isApplicationAssetError(error: unknown): boolean {
  if (error && typeof error === 'object' && preloadErrors.has(error)) return true;
  const message = error && typeof error === 'object' && 'message' in error ? error.message : error;
  return typeof message === 'string' && /loading chunk|dynamically imported module|importing a module script failed|failed to fetch dynamically|not a valid javascript mime type|unable to preload css/i.test(message);
}
