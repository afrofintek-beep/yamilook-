import { digest, uuid } from './security.mjs';
export function store(env, fetcher = fetch) {
  const base = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const request = async (path, { method = 'GET', body, authorization, service = true, prefer } = {}) => {
    const response = await fetcher(`${base}${path}`, { method, headers: {
      apikey: service ? key : env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: service ? `Bearer ${key}` : authorization,
      'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) throw Object.assign(new Error('database_unavailable'), { status: response.status });
    const text = await response.text(); return text ? JSON.parse(text) : null;
  };
  const table = (name, filters = {}) => `/rest/v1/linkedin_${name}?${new URLSearchParams(filters)}`;
  return {
    async authenticate(authorization) {
      if (!/^Bearer [\w.~-]+$/.test(authorization || '')) throw new Error('unauthorized');
      let user;
      try { user = await request('/auth/v1/user', { service: false, authorization }); } catch { throw new Error('unauthorized'); }
      if (!uuid(user?.id) || user.is_anonymous) throw new Error('unauthorized');
      const session = await request('/rest/v1/rpc/account_current_session_id', { method: 'POST', service: false, authorization, body: {} });
      if (!uuid(session)) throw new Error('unauthorized');
      return user.id;
    },
    async post(postId, userId, authorization) {
      if (!uuid(postId)) throw new Error('invalid_request');
      const rows = await request(`/rest/v1/posts?${new URLSearchParams({ select: 'id,user_id,content,media_urls,is_hidden', id: `eq.${postId}`, user_id: `eq.${userId}`, is_hidden: 'eq.false' })}`, { service: false, authorization });
      if (!rows?.[0]) throw new Error('post_unavailable');
      return digest(JSON.stringify(rows[0]));
    },
    get: (name, filters) => request(table(name, filters)),
    insert: (name, body, upsert = false) => request(table(name), { method: 'POST', body, prefer: `return=representation${upsert ? ',resolution=merge-duplicates' : ''}` }),
    patch: (name, filters, body) => request(table(name, filters), { method: 'PATCH', body, prefer: 'return=representation' }),
    delete: (name, filters) => request(table(name, filters), { method: 'DELETE', prefer: 'return=representation' }),
  };
}
