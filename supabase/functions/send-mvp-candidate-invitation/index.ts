import { sendCandidateEmail } from '../_shared/send-candidate-email.ts';
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
    const { candidateId, language, action } = JSON.parse(raw);
    if (typeof candidateId !== 'string' || !/^[0-9a-f-]{36}$/i.test(candidateId)) return reply({ error: 'request' }, 400);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !auth.user) return reply({ error: 'auth' }, 401);
    const { data: allowed, error: roleError } = await client.rpc('has_role', { _user_id: auth.user.id, _role: 'admin' });
    if (roleError || !allowed) return reply({ error: 'forbidden' }, 403);
    if (action === 'approve') {
      const { data: approval, error: approvalError } = await client.rpc('record_mvp_candidate_approval', {p_candidate_id:candidateId});
      if (approvalError) return reply({success:false,error:'approval_failed'},503);
      // A previous call may already have committed approval before a timeout.
      const {data: candidate} = await client.from('mvp_candidates')
        .select('full_name,email,access_code,invite_sent_at').eq('id',candidateId).eq('status','approved').eq('code_used',false).maybeSingle();
      if (!candidate?.access_code) return reply({success:false,error:approval?.error ?? 'candidate_unavailable'});
      let sent = Boolean(candidate.invite_sent_at);
      for (let attempt=0; !sent && attempt<2; attempt++) {
        try {
          const delivery = await sendCandidateEmail(client,candidateId,language,reply);
          sent = delivery.ok;
          if (!sent && delivery.status < 500) break;
        } catch { /* Retry with the same provider idempotency key. */ }
      }
      if (!sent) return reply({success:false,error:'Candidatura aprovada. Falhou o envio do convite. Podes repetir o envio.'});
      return reply({success:true,access_code:candidate.access_code,candidate_name:candidate.full_name,
        candidate_email:candidate.email,email_sent:true});
    }
    return await sendCandidateEmail(client, candidateId, language, reply);
  } catch { return reply({ error: 'unavailable' }, 500); }
});
