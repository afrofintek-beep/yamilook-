import { createClient } from 'npm:@supabase/supabase-js@2.90.1';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'auth' }, 401);
  try {
    const raw = await req.text();
    if (raw.length > 1024) return reply({ error: 'size' }, 413);
    const { candidateId } = JSON.parse(raw);
    if (typeof candidateId !== 'string' || !/^[0-9a-f-]{36}$/i.test(candidateId)) return reply({ error: 'request' }, 400);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !auth.user) return reply({ error: 'auth' }, 401);
    const { data: allowed, error: roleError } = await client.rpc('has_role', { _user_id: auth.user.id, _role: 'admin' });
    if (roleError || !allowed) return reply({ error: 'forbidden' }, 403);
    // Recipient and code are always resolved on the server, never accepted from the caller.
    const { data: candidate, error } = await client.from('mvp_candidates')
      .select('id, full_name, email, access_code, invite_sent_at').eq('id', candidateId)
      .eq('status', 'approved').eq('code_used', false).single();
    if (error || !candidate?.access_code) return reply({ error: 'candidate_unavailable' }, 404);
    if (candidate.invite_sent_at && Date.now() - Date.parse(candidate.invite_sent_at) < 86400000)
      return reply({ accepted: true, alreadySent: true });
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('YAMILOOK_INVITE_EMAIL_FROM');
    if (!apiKey || !from) return reply({ error: 'email_not_configured' }, 503);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `mvp-${candidate.id}-${candidate.access_code}-${new Date().toISOString().slice(0,10)}` },
      body: JSON.stringify({ from, to: [candidate.email], subject: 'A tua candidatura à YAMILOOK foi aprovada',
        text: `Olá ${candidate.full_name},\n\nA tua candidatura ao MVP da YAMILOOK foi aprovada!\n\nCria a tua conta em https://www.yamilook.com/register e insere o código ${candidate.access_code}.\n\nEste código é de utilização única.\n\nBem-vindo(a)!\nEquipa YAMILOOK` }),
    });
    if (!response.ok) return reply({ error: 'email_delivery_failed' }, 502);
    const { error: saveError } = await client.from('mvp_candidates').update({ invite_sent_at: new Date().toISOString() }).eq('id', candidate.id);
    return reply({ accepted: true, trackingSaved: !saveError });
  } catch { return reply({ error: 'unavailable' }, 500); }
});
