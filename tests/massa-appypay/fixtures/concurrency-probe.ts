import { createClient } from 'npm:@supabase/supabase-js@2.90.1';

// TEST FIXTURE ONLY. Deploy temporarily to massa-test-concurrency on this exact
// project with verify_jwt=false. Replace the placeholder only in the deployment
// payload. The random bearer token itself must never appear in this file.
const expectedUrl = 'https://kvnbqqektpkeouyepyor.supabase.co';
const tokenHash = 'PROBE_TOKEN_SHA256';
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
type Metric = { backend_pid: number; started_at: string; rpc_returned_at: string; finished_at: string; id: string; submit: boolean | null; state: string; initial_state: string | null; holds_wallet_lock: boolean };
const overlap = (metrics: Metric[]) => metrics.length === 2
  && metrics[0].backend_pid !== metrics[1].backend_pid
  && Math.max(...metrics.map(m => Date.parse(m.started_at))) < Math.min(...metrics.map(m => Date.parse(m.finished_at)));

Deno.serve(async request => {
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (Deno.env.get('SUPABASE_URL') !== expectedUrl || !/^[0-9a-f]{64}$/.test(tokenHash)) {
    return reply(503, { error: 'probe_disabled' });
  }
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token.length < 32 || token.length > 256) return reply(401, { error: 'unauthorised' });
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= digest.charCodeAt(i) ^ tokenHash.charCodeAt(i);
  if (difference !== 0) return reply(401, { error: 'unauthorised' });
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) return reply(503, { error: 'probe_disabled' });
  const client = createClient(expectedUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async (action: string) => {
    const { data, error } = await client.rpc('massa_test_probe', { p_action: action });
    if (error) throw new Error('probe_failed');
    return data;
  };
  try {
    await rpc('start');
  } catch {
    return reply(409, { error: 'probe_used_or_unavailable' });
  }
  try {
    const prepare: Metric[] = await Promise.all([rpc('prepare'), rpc('prepare')]);
    const confirm: Metric[] = await Promise.all([rpc('confirm'), rpc('confirm')]);
    const ledger = await rpc('finish');
    return reply(200, { prepare, confirm, prepare_overlap: overlap(prepare), confirm_overlap: overlap(confirm), ledger });
  } catch {
    return reply(500, { error: 'probe_failed' });
  }
});
