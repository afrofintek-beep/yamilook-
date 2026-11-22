/**
 * A stored media value is untrusted even when it came from our database.
 * Private attachment references must be authorized separately before this
 * boundary. URL validation is not an antivirus or a trust verdict on a file.
 */
export function safeMediaUrl(value: string, localOrigin?: string): string | undefined {
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.username || url.password) return undefined;
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    // Keep optimistic locally recorded audio working. Never accept a blob URL
    // from a different origin or an opaque ("null") origin.
    if (url.protocol === 'blob:' && localOrigin && url.origin !== 'null' && url.origin === localOrigin) return url.href;
  } catch { /* Invalid, relative and unsupported URLs are unavailable. */ }
  return undefined;
}
