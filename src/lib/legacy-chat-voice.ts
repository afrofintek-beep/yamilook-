/** Recognize only legacy voice objects in this application's Storage project. */
export function legacyChatVoicePath(reference: string, projectUrl: string | undefined): string | null {
  try {
    if (!projectUrl) return null;
    const url = new URL(reference);
    if (url.origin !== new URL(projectUrl).origin || url.username || url.password) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/voice-messages\/(.+)$/);
    if (!match) return null;
    const path = decodeURIComponent(match[1]);
    return path && !/[\x00-\x1f\x7f?#]/.test(path) && !path.split('/').some(part => !part || part === '.' || part === '..') ? path : null;
  } catch { return null; }
}
