import { isPostId, postUrl } from './public-post.mjs';
export function shareDestinations(id) {
  if (!isPostId(id)) return [];
  const url = postUrl(id);
  return [
    { id: 'kosolola', label: 'KOSOLOLA', url: `https://www.kosolola.com/papos-app/share/post/${id}` },
    { id: 'whatsapp', label: 'WhatsApp', url: `https://wa.me/?text=${encodeURIComponent(url)}` },
    { id: 'facebook', label: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { id: 'linkedin', label: 'LinkedIn', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { id: 'x', label: 'X', url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}` },
  ];
}
export function sharedPostId(content) {
  if (typeof content !== 'string') return null;
  try {
    const url = new URL(content.trim());
    if (url.origin !== 'https://www.yamilook.com' || url.search || url.hash || url.username || url.password) return null;
    const match = /^\/post\/([^/]+)\/?$/.exec(url.pathname);
    return match && isPostId(match[1]) ? match[1] : null;
  } catch { return null; }
}
