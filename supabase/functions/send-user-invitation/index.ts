import { createClient } from 'npm:@supabase/supabase-js@2.90.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: cors });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^[A-F0-9]{16}$/;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

function invitationEmail(email: string, code: string) {
  const link = 'https://www.yamilook.com/register?ref=' + encodeURIComponent(code);
  const safeEmail = escapeHtml(email);
  const safeLink = escapeHtml(link);
  return {
    subject: 'O teu convite para a YAMILOOK',
    html: `<!doctype html><html lang="pt"><body style="margin:0;padding:32px 12px;background:#f5f5f7;font-family:Arial,sans-serif;color:#14213d">
      <div style="max-width:520px;margin:auto;padding:32px;border-radius:18px;background:#101827">
        <div style="font-size:24px;font-weight:800;letter-spacing:2px;color:#d7ae34">YAMILOOK</div>
        <h1 style="color:white;font-size:22px;margin:30px 0 10px">Tens um convite pessoal</h1>
        <p style="color:#e6e7eb;line-height:1.6">Foste convidado(a) a fazer parte da YAMILOOK. Este convite é de utilização única e está associado ao email <strong>${safeEmail}</strong>.</p>
        <p style="margin:32px 0"><a href="${safeLink}" style="background:#d7ae34;color:#111827;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px">Aceitar convite</a></p>
        <p style="color:#d6d6d6;font-size:13px">Se o botão não funcionar, abre: <a style="color:#f8d574;word-break:break-all" href="${safeLink}">${safeLink}</a></p>
        <p style="color:#a1a6b0;font-size:12px;margin-top:28px">Se não pediste este convite, podes ignorar esta mensagem.</p>
      </div></body></html>`,
    text: `Foste convidado(a) para a YAMILOOK. Este convite é pessoal, de utilização única, e destina-se a ${email}. Regista-te em: ${link}`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply({ error: 'auth' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return reply({ error: 'unavailable' }, 503);
  try {
    const raw = await req.text();
    if (raw.length > 2048) return reply({ error: 'size' }, 413);
    const payload = JSON.parse(raw);
    if (!payload || typeof payload.email !== 'string' || typeof payload.code !== 'string')
      return reply({ error: 'request' }, 400);
    const email = payload.email.trim().toLowerCase();
    const code = payload.code.trim().toUpperCase();
    if (email.length > 254 || !EMAIL.test(email) || !CODE.test(code)) return reply({ error: 'request' }, 400);

    // Caller-scoped PostgREST requests respect RLS; never expose service_role to users.
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader! } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: authError } = await client.auth.getUser(token);
    const userId = userData.user?.id;
    if (authError || !userId) return reply({ error: 'auth' }, 401);
    const { data: allowed, error: allowedError } = await client.rpc('can_issue_user_invitation', { p_user_id: userId });
    if (allowedError || allowed !== true) return reply({ error: 'forbidden' }, 403);
    const { data: invitation, error: lookupError } = await client.from('user_invitations')
      .select('code')
      .eq('code', code)
      .eq('recipient_email', email)
      .eq('invited_by', userId)
      .is('used_at', null)
      .maybeSingle();
    if (lookupError || !invitation) return reply({ error: 'invitation_unavailable' }, 404);

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('YAMILOOK_INVITE_EMAIL_FROM');
    if (!apiKey || !from) return reply({ error: 'email_not_configured' }, 503);
    if (!/^[^\r\n<>]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(from))
      return reply({ error: 'email_not_configured' }, 503);

    const message = invitationEmail(email, code);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Resend suppresses exact duplicate requests within its 24h retention window.
        'Idempotency-Key': `yamilook-invite-${code}`,
      },
      body: JSON.stringify({ from, to: [email], ...message }),
    });
    if (!response.ok) {
      console.error('Invitation email provider rejected request', response.status);
      return reply({ error: 'email_delivery_failed' }, 502);
    }
    const result = await response.json().catch(() => ({}));
    return reply({ ok: true, accepted: true, messageId: result.id ?? null });
  } catch (error) {
    console.error('Invitation email endpoint unavailable', error instanceof SyntaxError ? 'request' : 'internal');
    return reply({ error: 'unavailable' }, 500);
  }
});
