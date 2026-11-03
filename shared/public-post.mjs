// Used by the server-rendered sharing page and the SPA fallback. Always anonymous:
// a signed-in visitor must not make a restricted post appear publicly shareable.
export const PUBLIC_ORIGIN = 'https://www.yamilook.com';
export const isPostId = (value) => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const postUrl = (id) => `${PUBLIC_ORIGIN}/post/${encodeURIComponent(id)}`;
export const isVideo = (url) => /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(url);
export function safeMediaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export async function loadPublicPost(id, { url, key, fetcher = fetch, signal } = {}) {
  if (!isPostId(id)) return null;
  if (!url || !key) throw new Error('Public post service unavailable');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const query = new URLSearchParams({
    select: 'id,user_id,type,content,media_urls,privacy,is_hidden,created_at',
    id: `eq.${id}`, privacy: 'eq.everyone', is_hidden: 'eq.false', limit: '1',
  });
  const response = await fetcher(`${url}/rest/v1/posts?${query}`, { headers, signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Public post service unavailable');
  const [post] = await response.json();
  // Defence in depth: never render restricted or moderated data even if an
  // upstream policy/configuration changes. RLS remains the authorization layer.
  if (!post || post.id.toLowerCase() !== id.toLowerCase() || post.privacy !== 'everyone' || post.is_hidden !== false) return null;
  let author = null;
  try {
    const result = await fetcher(`${url}/rest/v1/rpc/get_public_profiles_by_ids`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_ids: [post.user_id] }), signal, cache: 'no-store',
    });
    if (result.ok) author = (await result.json()).find((item) => item.id === post.user_id) || null;
  } catch { /* The public content remains readable if author lookup fails. */ }
  return {
    id: post.id, type: post.type, content: post.content || '', created_at: post.created_at,
    media_urls: (post.media_urls || []).map(safeMediaUrl).filter(Boolean),
    author: {
      display_name: author?.display_name?.trim() || 'Yamilook',
      username: author?.username?.trim() || '',
      avatar_url: safeMediaUrl(author?.avatar_url),
    },
  };
}
