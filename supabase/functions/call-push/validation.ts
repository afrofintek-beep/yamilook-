export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function allowedEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.hash && (
      u.hostname === 'web.push.apple.com' || u.hostname.endsWith('.push.apple.com') ||
      u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com'
    );
  } catch { return false; }
}
export function validSubscription(value: unknown): value is {endpoint: string; keys: {p256dh: string; auth: string}} {
  const s = value as {endpoint?: unknown; keys?: {p256dh?: unknown; auth?: unknown}} | null;
  return !!s && allowedEndpoint(s.endpoint) && typeof s.keys?.p256dh === 'string' &&
    /^[A-Za-z0-9_-]{87}=?$/.test(s.keys.p256dh) && typeof s.keys.auth === 'string' && /^[A-Za-z0-9_-]{22}={0,2}$/.test(s.keys.auth);
}
export function activeCall(call: {status: string; created_at: string; initiator_id: string} | null, caller: string, now = Date.now()) {
  if (!call || call.initiator_id !== caller || call.status !== 'ringing') return false;
  const age = now - Date.parse(call.created_at);
  return Number.isFinite(age) && age >= -5000 && age < 90000;
}
