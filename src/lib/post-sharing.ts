import { uiText } from '@/i18n/ui-copy';
import { getYamilookPublicUrl } from './public-site';
export function publicPostUrl(id: string) {
  return getYamilookPublicUrl(`/post/${encodeURIComponent(id)}`);
}
export async function sharePostLink(id: string, { title = 'Yamilook', copyOnly = false } = {}): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = publicPostUrl(id);
  if (!copyOnly && navigator.share) {
    try { await navigator.share({ title, url }); return 'shared'; }
    catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled';
      // Some in-app browsers expose Web Share but reject it. Offer clipboard.
    }
  }
  if (!navigator.clipboard?.writeText) throw new Error(uiText("Clipboard unavailable"));
  await navigator.clipboard.writeText(url);
  return 'copied';
}
