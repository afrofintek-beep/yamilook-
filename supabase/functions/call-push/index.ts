import { createClient } from 'npm:@supabase/supabase-js@2.90.1';
import webpush from 'npm:web-push@3.6.7';
import { activeCall, allowedEndpoint, validSubscription, UUID } from './validation.ts';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: cors });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
    if (!token) return reply({ error: 'auth' }, 401);
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return reply({ error: 'auth' }, 401);
    const raw = await req.text();
    if (raw.length > 6000) return reply({ error: 'size' }, 413);
    const body = JSON.parse(raw);
    let publicKey = Deno.env.get('CALL_PUSH_VAPID_PUBLIC_KEY');
    let privateKey = Deno.env.get('CALL_PUSH_VAPID_PRIVATE_KEY');
    let subject = Deno.env.get('CALL_PUSH_VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) {
      const { data: secrets, error } = await db.rpc('get_call_push_vapid');
      if (error) throw error;
      publicKey = secrets?.call_push_vapid_public;
      privateKey = secrets?.call_push_vapid_private;
      subject = secrets?.call_push_vapid_subject;
    }
    const configured = !!(publicKey && privateKey && subject);
    if (body.action === 'config') return reply({ configured, publicKey: configured ? publicKey : null });
    if (body.action === 'remove') {
      if (!allowedEndpoint(body.endpoint)) return reply({ error: 'endpoint' }, 400);
      const { error } = await db.from('call_push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', body.endpoint);
      if (error) throw error;
      return reply({ ok: true });
    }
    if (!configured) return reply({ error: 'not_configured' }, 503);
    if (body.action === 'subscribe') {
      if (!validSubscription(body.subscription)) return reply({ error: 'subscription' }, 400);
      const s = body.subscription;
      // Expire abandoned sessions. The client renews on foreground activity.
      const { error } = await db.from('call_push_subscriptions').upsert({ endpoint: s.endpoint, user_id: user.id, p256dh: s.keys.p256dh, auth: s.keys.auth,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString() }, { onConflict: 'endpoint' });
      if (error) throw error;
      return reply({ ok: true });
    }
    if (body.action !== 'send' || typeof body.callId !== 'string' || !UUID.test(body.callId)) return reply({ error: 'request' }, 400);
    const { data: call, error: callError } = await db.from('calls').select('id,status,initiator_id,created_at').eq('id', body.callId).maybeSingle();
    if (callError) throw callError;
    if (!activeCall(call, user.id)) return reply({ error: 'call_unavailable' }, 403);
    const { data: participants, error: participantError } = await db.from('call_participants').select('user_id').eq('call_id', call.id).eq('status', 'ringing').neq('user_id', user.id);
    if (participantError) throw participantError;
    let sent = 0;
    for (const participant of participants ?? []) {
      const recipient = participant.user_id;
      const { data: blocks, error: blockError } = await db.from('blocked_users').select('id').or(`and(blocker_id.eq.${recipient},blocked_id.eq.${user.id}),and(blocker_id.eq.${user.id},blocked_id.eq.${recipient})`).limit(1);
      if (blockError) throw blockError;
      if (blocks?.length) continue;
      const { data: subscriptions, error: subError } = await db.from('call_push_subscriptions').select('*').eq('user_id', recipient).gt('expires_at', new Date().toISOString()).limit(10);
      if (subError) throw subError;
      for (const s of subscriptions ?? []) {
        if (!allowedEndpoint(s.endpoint)) continue;
        // Atomic claim also rate-limits recipients across simultaneous callers.
        const { data: claimed, error: claimError } = await db.rpc('claim_call_push', { p_call_id: call.id, p_subscription_id: s.id });
        if (claimError) throw claimError;
        if (!claimed) continue;
        const { data: current, error: stateError } = await db.from('calls').select('status,created_at,initiator_id').eq('id', call.id).maybeSingle();
        if (stateError) throw stateError;
        if (!activeCall(current, user.id)) continue;
        try {
          const expiresAt = Date.parse(call.created_at) + 90000;
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ type: 'incoming-call', callId: call.id, expiresAt }), {
            TTL: Math.max(0, Math.min(30, Math.floor((expiresAt - Date.now()) / 1000))), urgency: 'high', timeout: 8000,
            vapidDetails: { subject: subject!, publicKey: publicKey!, privateKey: privateKey! },
          });
          sent++;
        } catch (error) {
          const status = (error as {statusCode?: number}).statusCode;
          if (status === 404 || status === 410) await db.from('call_push_subscriptions').delete().eq('id', s.id);
          // No endpoints, keys, tokens or payloads in logs. A failed send is
          // retained as an attempt to avoid duplicate alerts after a timeout.
          console.warn('call-push delivery failed', status ?? 'network');
        }
      }
    }
    return reply({ ok: true, sent });
  } catch {
    return reply({ error: 'unavailable' }, 500);
  }
});
