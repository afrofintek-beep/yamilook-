/** Readiness boundary shared with tests. No partner or database write port exists. */
export async function handleVerificationRequest(
  req: Request,
  getIdentity: (token: string) => Promise<{ id: string } | null>,
): Promise<Response> {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  const json = (reason: string, status: number) => new Response(JSON.stringify({ certified: false, reason }), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST, OPTIONS' } });
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ') || !authorization.slice(7).trim()) return json('unauthorized', 401);
  try {
    if (!await getIdentity(authorization.slice(7))) return json('unauthorized', 401);
    const body = await req.json().catch(() => null);
    if (body?.consent !== true || typeof body.code !== 'string' || !body.code.trim()) return json('consent_required', 400);
    // Deliberate release interlock. A boolean-only partner reply cannot establish
    // ownership, provenance, expiry or revocation. No environment flag bypasses it.
    return json('integration_pending', 503);
  } catch {
    return json('verification_unavailable', 503);
  }
}
