import { actor, admin, body, failure, json, preflight, rpc } from '../_shared/account-link.ts';

Deno.serve(async (req) => {
 const early = preflight(req); if (early) return early;
 try {
  if (Deno.env.get('PHONE_ACCESS_ENABLED') !== 'true') return json({ ok: false, reason: 'unavailable' }, 503);
  const userId = await actor(req);
  const input = await body(req);
  if (!['search','status','consent'].includes(input.action) ||
      (input.action === 'search' && (typeof input.phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(input.phone))) ||
      (input.action === 'consent' && typeof input.enabled !== 'boolean')) return json({ ok: false }, 400);
  const result = await rpc(admin(), 'phone_directory_action', {
   p_actor: userId, p_action: input.action,
   p_phone: input.action === 'search' ? input.phone : null,
   p_enabled: input.action === 'consent' ? input.enabled : null,
  });
  return json(result, result?.reason === 'rate_limited' ? 429 : 200);
 } catch (error) { return failure(error); }
});
