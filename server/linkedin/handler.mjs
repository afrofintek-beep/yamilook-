import { randomUUID } from 'node:crypto';
import { digest, nonce, equal, encryptionKey, seal, unseal, returnPath, mediaSpec, uuid } from './security.mjs';
import { provider, ProviderError } from './provider.mjs';
import { store } from './store.mjs';
const cookieName = '__Host-yamilook-linkedin-state';
const cookie = (value, seconds) => `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
const redirect = (location, clear = true) => new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...(clear ? { 'Set-Cookie': cookie('', 0) } : {}) } });
export function configured(env) {
  return env.LINKEDIN_PUBLISH_ENABLED === 'true' && ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_ENCRYPTION_KEY', 'LINKEDIN_ORIGIN', 'LINKEDIN_API_VERSION', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'].every(key => !!env[key]);
}
export async function handleLinkedIn(req, { env = process.env, fetcher = fetch, db = store(env, fetcher), makeProvider = provider } = {}) {
  const url = new URL(req.url), action = url.searchParams.get('action') || (url.pathname.endsWith('/callback') ? 'callback' : 'status');
  try {
    if (!configured(env)) return action === 'status' ? json({ enabled: false, connected: false }) : json({ error: 'integration_disabled' }, 503);
    const origin = new URL(env.LINKEDIN_ORIGIN).origin;
    if (!origin.startsWith('https://') || url.origin !== origin) return json({ error: 'invalid_origin' }, 403);
    const key = encryptionKey(env.LINKEDIN_ENCRYPTION_KEY), callback = `${origin}/api/linkedin/callback`;
    const now = new Date().toISOString();
    if (action === 'callback') {
      if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
      const state = url.searchParams.get('state');
      const browserState = req.headers.get('cookie')?.split('; ').find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
      if (!state || !equal(state, browserState)) return json({ error: 'invalid_oauth_state' }, 400);
      const rows = await db.delete('oauth_states', { state_hash: `eq.${digest(state)}`, expires_at: `gt.${now}` });
      if (!rows?.[0]) return json({ error: 'expired_oauth_state' }, 400, { 'Set-Cookie': cookie('', 0) });
      const pending = rows[0], back = new URL(returnPath(pending.return_path), origin);
      if (url.searchParams.has('error') || !url.searchParams.get('code')) { back.searchParams.set('linkedin', 'cancelled'); return redirect(back.href); }
      const tokenResponse = await fetcher('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: callback, client_id: env.LINKEDIN_CLIENT_ID, client_secret: env.LINKEDIN_CLIENT_SECRET }), redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!tokenResponse.ok) { back.searchParams.set('linkedin', 'failed'); return redirect(back.href); }
      const token = await tokenResponse.json();
      if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in < 60) throw new Error('oauth_failed');
      if (token.scope && !token.scope.split(/[ ,]+/).includes('w_member_social')) throw new Error('oauth_failed');
      const identityResponse = await fetcher('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!identityResponse.ok) throw new Error('oauth_failed');
      const identity = await identityResponse.json();
      if (typeof identity.sub !== 'string' || !/^[\w-]+$/.test(identity.sub)) throw new Error('oauth_failed');
      await db.insert('connections', { user_id: pending.user_id, subject: identity.sub, display_name: String(identity.name || 'LinkedIn').slice(0, 200), token_ciphertext: seal(token.access_token, key, pending.user_id), expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString() }, true);
      back.searchParams.set('linkedin', 'connected'); return redirect(back.href);
    }
    if (!['status', 'draft'].includes(action) && req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    if (['status', 'draft'].includes(action) && req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
    if (req.method === 'POST' && req.headers.get('origin') !== origin) return json({ error: 'invalid_origin' }, 403);
    const authorization = req.headers.get('authorization'), userId = await db.authenticate(authorization);
    const input = req.method === 'POST' && action !== 'upload' ? await req.json() : {};
    if (action === 'connect') {
      await db.delete('oauth_states', { user_id: `eq.${userId}` });
      const state = nonce();
      await db.insert('oauth_states', { state_hash: digest(state), user_id: userId, return_path: returnPath(input.returnPath), expires_at: new Date(Date.now() + 600000).toISOString() });
      const destination = new URL('https://www.linkedin.com/oauth/v2/authorization');
      destination.search = new URLSearchParams({ response_type: 'code', client_id: env.LINKEDIN_CLIENT_ID, redirect_uri: callback, state, scope: 'openid profile w_member_social', enable_extended_login: 'true' }).toString();
      return json({ url: destination.href }, 200, { 'Set-Cookie': cookie(state, 600) });
    }
    if (action === 'disconnect') {
      await db.delete('connections', { user_id: `eq.${userId}` });
      await db.delete('oauth_states', { user_id: `eq.${userId}` });
      await db.patch('drafts', { user_id: `eq.${userId}`, status: 'in.(uploading,processing,ready)' }, { status: 'failed', upload_ciphertext: null });
      return json({ connected: false });
    }
    const connection = (await db.get('connections', { user_id: `eq.${userId}`, expires_at: `gt.${now}` }))?.[0];
    if (action === 'status') return json({ enabled: true, connected: !!connection, name: connection?.display_name });
    if (!connection) return json({ error: 'connect_linkedin' }, 401);
    const api = makeProvider({ token: unseal(connection.token_ciphertext, key, userId), version: env.LINKEDIN_API_VERSION, fetcher });
    if (action === 'initialize') {
      const kind = mediaSpec(input.type, input.size);
      const fingerprint = await db.post(input.postId, userId, authorization);
      const unresolved = await db.get('drafts', { user_id: `eq.${userId}`, post_id: `eq.${input.postId}`, status: 'in.(publishing,uncertain)', limit: '1' });
      if (unresolved.length) return json({ error: 'publication_uncertain' }, 409);
      const recent = await db.get('drafts', { user_id: `eq.${userId}`, created_at: `gt.${new Date(Date.now() - 3600000).toISOString()}`, select: 'id', limit: '10' });
      if (recent.length >= 10) return json({ error: 'rate_limited' }, 429);
      const prepared = await api.initialize(kind, `urn:li:person:${connection.subject}`, input.size), id = randomUUID();
      await db.insert('drafts', { id, user_id: userId, post_id: input.postId, post_fingerprint: fingerprint, subject: connection.subject, media_type: input.type, media_urn: prepared.media, size: input.size, upload_ciphertext: seal(prepared, key, id), status: 'uploading' });
      return json({ id, parts: prepared.parts.map(({ firstByte, lastByte }) => ({ firstByte, lastByte })) });
    }
    const draftId = url.searchParams.get('draft') || input.draft;
    if (!uuid(draftId)) return json({ error: 'invalid_request' }, 400);
    const filter = { id: `eq.${draftId}`, user_id: `eq.${userId}` };
    const draft = (await db.get('drafts', filter))?.[0];
    if (!draft || draft.subject !== connection.subject) return json({ error: 'draft_unavailable' }, 404);
    if (action === 'draft') {
      if (draft.status === 'processing') {
        if (await api.ready(draft.media_urn)) { await db.patch('drafts', { ...filter, status: 'eq.processing' }, { status: 'ready' }); draft.status = 'ready'; }
      }
      return json({ id: draft.id, status: draft.status, postId: draft.linkedin_post_id });
    }
    if (action === 'publish' && draft.status === 'published') return json({ status: 'published', postId: draft.linkedin_post_id });
    if (new Date(draft.expires_at).getTime() <= Date.now()) return json({ error: 'draft_expired' }, 410);
    if (action === 'upload') {
      if (draft.status !== 'uploading') return json({ error: 'invalid_draft_state' }, 409);
      const info = unseal(draft.upload_ciphertext, key, draftId), part = Number(url.searchParams.get('part'));
      if (!Number.isSafeInteger(part) || part < 0 || !info.parts[part]) return json({ error: 'invalid_part' }, 400);
      const bytes = Buffer.from(await req.arrayBuffer()), expected = info.parts[part];
      if (bytes.length !== expected.lastByte - expected.firstByte + 1) return json({ error: 'invalid_part_size' }, 400);
      const etag = await api.upload(expected, bytes, draft.media_type);
      if (draft.media_type === 'video/mp4' && !etag) throw new Error('missing_upload_id');
      await db.insert('upload_parts', { draft_id: draftId, part, etag }, true);
      return json({ uploaded: true });
    }
    if (action === 'finalize') {
      if (draft.status !== 'uploading') return json({ status: draft.status });
      const info = unseal(draft.upload_ciphertext, key, draftId), parts = await db.get('upload_parts', { draft_id: `eq.${draftId}`, order: 'part.asc' });
      if (parts.length !== info.parts.length || parts.some((p, i) => p.part !== i)) return json({ error: 'upload_incomplete' }, 409);
      if (draft.media_type === 'video/mp4') await api.finalize(draft.media_urn, info.uploadToken, parts.map(part => part.etag));
      const status = draft.media_type === 'video/mp4' ? 'processing' : 'ready';
      await db.patch('drafts', { ...filter, status: 'eq.uploading' }, { status, upload_ciphertext: null });
      return json({ status });
    }
    if (action === 'publish') {
      if (draft.status !== 'ready') return json({ error: draft.status === 'publishing' || draft.status === 'uncertain' ? 'publication_uncertain' : 'invalid_draft_state' }, 409);
      if (input.confirm !== true || !['PUBLIC', 'CONNECTIONS'].includes(input.visibility) || typeof input.commentary !== 'string' || input.commentary.length > 3000) return json({ error: 'confirmation_required' }, 400);
      if (await db.post(draft.post_id, userId, authorization) !== draft.post_fingerprint) return json({ error: 'post_changed' }, 409);
      // Compare-and-set is the at-most-once boundary. Never reset publishing or uncertain automatically.
      const claimed = await db.patch('drafts', { ...filter, status: 'eq.ready' }, { status: 'publishing', commentary: input.commentary, visibility: input.visibility });
      if (!claimed.length) return json({ error: 'publication_uncertain' }, 409);
      try {
        const postId = await api.publish(`urn:li:person:${connection.subject}`, draft.media_urn, input.commentary, input.visibility);
        await db.patch('drafts', filter, { status: 'published', linkedin_post_id: postId });
        return json({ status: 'published', postId });
      } catch (error) {
        const definitive = error instanceof ProviderError && error.status >= 400 && error.status < 500;
        await db.patch('drafts', filter, { status: definitive ? 'failed' : 'uncertain' }).catch(() => {});
        return json({ error: definitive ? 'linkedin_rejected' : 'publication_uncertain' }, definitive ? 422 : 409);
      }
    }
    return json({ error: 'invalid_action' }, 400);
  } catch (error) {
    const safe = ['unauthorized', 'invalid_request', 'unsupported_media', 'media_too_large', 'post_unavailable', 'processing_failed'];
    return json({ error: safe.includes(error.message) ? error.message : 'service_unavailable' }, error.message === 'unauthorized' ? 401 : safe.includes(error.message) ? 400 : 503);
  }
}
