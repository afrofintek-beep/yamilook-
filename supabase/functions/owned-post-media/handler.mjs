import { ownedMediaDescriptor } from '../../../shared/owned-post-media.mjs';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const headers = {
  'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'X-Content-Type-Options': 'nosniff',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function handleOwnedPostMedia(req, { url, key, fetcher = fetch }) {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.match(/^Bearer [\w.~-]+$/)) return json({ error: 'unauthorized' }, 401);
  try {
    const raw = await req.text();
    if (raw.length > 4096) return json({ error: 'invalid_request' }, 400);
    let input;
    try { input = JSON.parse(raw); } catch { return json({ error: 'invalid_request' }, 400); }
    if (!uuid(input?.postId) || !Number.isSafeInteger(input?.index) || input.index < 0) return json({ error: 'invalid_request' }, 400);
    if (!url || !key) throw new Error('configuration');
    const base = new URL(url).origin;
    const options = { headers: { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000), cache: 'no-store' };
    // Validate with Auth; never trust a client user_id or decoded JWT payload.
    const identity = await fetcher(`${base}/auth/v1/user`, options);
    if (identity.status >= 500) throw new Error('auth_unavailable');
    if (!identity.ok) return json({ error: 'unauthorized' }, 401);
    const user = await identity.json();
    if (!uuid(user?.id) || user.is_anonymous) return json({ error: 'unauthorized' }, 401);
    const session = await fetcher(`${base}/rest/v1/rpc/account_current_session_id`, { ...options, method: 'POST', body: '{}' });
    if (session.status >= 500) throw new Error('session_unavailable');
    if (!session.ok || !uuid(await session.json())) return json({ error: 'unauthorized' }, 401);
    // User JWT keeps RLS active; an additional ownership filter restricts this
    // export operation even when the viewer is allowed to read somebody's post.
    const query = new URLSearchParams({ select: input.mode === 'branding' ? 'id,user_id,media_urls,is_hidden,content' : 'id,user_id,media_urls,is_hidden', id: `eq.${input.postId}`, user_id: `eq.${user.id}`, is_hidden: 'eq.false', limit: '1' });
    const response = await fetcher(`${base}/rest/v1/posts?${query}`, options);
    if (!response.ok) throw new Error('post_unavailable');
    const rows = await response.json();
    const post = rows?.[0];
    if (!post || post.id.toLowerCase() !== input.postId.toLowerCase() || post.user_id !== user.id || post.is_hidden !== false) return json({ error: 'media_unavailable' }, 404);
    if (input.mode === 'branding') {
      const profileQuery = new URLSearchParams({ select: 'id,display_name,username', id: `eq.${user.id}`, limit: '1' });
      const profileResponse = await fetcher(`${base}/rest/v1/profiles?${profileQuery}`, options);
      if (!profileResponse.ok) throw new Error('profile_unavailable');
      const profile = (await profileResponse.json())?.[0];
      if (profile?.id !== user.id) throw new Error('profile_unavailable');
      console.info('owned_post_export_authorized', { postId: post.id, userId: user.id });
      return json({ content: post.content || '', author: { name: profile.display_name?.trim() || 'Autor', username: profile.username?.trim() || '' } });
    }
    const descriptor = ownedMediaDescriptor(post, input.index, base);
    return descriptor ? json(descriptor) : json({ error: 'media_unavailable' }, 404);
  } catch { return json({ error: 'unavailable' }, 503); }
}
