import { createClient } from 'npm:@supabase/supabase-js@2.90.1';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

// The single-use invitation code is the bearer credential for this endpoint.
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return reply({ error: 'Método indisponível.' }, 405);
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: 'Pedido inválido.' }, 400);
    const body = JSON.parse(raw);
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body.password;
    if (!/^[A-F0-9]{16}$/.test(code) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 || typeof password !== 'string' || password.length < 8 ||
        password.length > 128 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return reply({ error: 'Confirma o convite, o email e a palavra-passe.' }, 400);
    }
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: invitation, error } = await client.from('user_invitations')
      .select('invited_by, used_at, expires_at, confirmation_policy')
      .eq('code', code).eq('recipient_email', email).maybeSingle();
    if (error || !invitation || invitation.confirmation_policy !== 'admin_waiver' ||
        invitation.used_at || !invitation.expires_at || Date.parse(invitation.expires_at) <= Date.now()) {
      return reply({ error: 'Convite indisponível. Confirma o email indicado pelo administrador.' }, 400);
    }
    const { data: admin, error: roleError } = await client.rpc('has_role', {
      _user_id: invitation.invited_by, _role: 'admin',
    });
    if (roleError || !admin) return reply({ error: 'Convite indisponível.' }, 403);
    // createUser never updates an existing account. Database triggers atomically
    // validate expiry, bind the email, consume the invitation and retain provenance.
    const { error: createError } = await client.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { known_contact_registration: true }, user_metadata: { access_code: code },
    });
    if (createError) return reply({ error: 'Não foi possível criar a conta. Se já te registaste, utiliza Entrar.' }, 400);
    return reply({ ok: true });
  } catch {
    return reply({ error: 'Não foi possível concluir o registo.' }, 400);
  }
});
