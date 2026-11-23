export type Result = Record<string, any> & { ok: boolean };
export interface Ports {
  rpc(action: string, input: Record<string, unknown>, actor?: string | null): Promise<Result>;
  getUser(jwt: string): Promise<{ id: string; is_anonymous?: boolean } | null>;
  createUser(attributes: Record<string, unknown>): Promise<{ id: string } | null>;
  signIn(identifier: string, password: string): Promise<Record<string, any> | null>;
  hashPassword(password: string): Promise<string>;
  sendSms(phone: string, otp: string, language: string): Promise<boolean>;
  smsReady: boolean;
  ratePepper: string;
  otpPepper: string;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const usernamePattern = /^[a-z0-9][a-z0-9_]{2,19}$/;
const tokenPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const languages = new Set(['pt','en','fr','ar','am','sw','ln','yo','sn','zu','kmb','umb','kik']);
const message: Record<string, string> = {
  invalid_request: 'Pedido inválido. Confirme os dados e tente novamente.',
  invalid_username: 'Escolha um nome de utilizador com 3 a 20 letras, números ou sublinhados.',
  weak_password: 'Use pelo menos 12 caracteres, incluindo maiúsculas, minúsculas e números.',
  terms_required: 'Aceite os termos para activar a conta.',
  invalid_invitation: 'Este convite já não está disponível. Peça um novo convite ao responsável.',
  username_unavailable: 'Este nome de utilizador não está disponível. Escolha outro.',
  invalid_otp: 'Código inválido ou expirado. Confirme o SMS ou peça um novo código.',
  rate_limited: 'Aguarde antes de tentar novamente.',
  sms_unavailable: 'A confirmação por SMS ainda não está disponível.',
  delivery_failed: 'Não foi possível enviar o SMS. Tente novamente mais tarde.',
  phone_unavailable: 'Não é possível usar este número neste convite. Utilize o acesso da conta existente ou contacte o responsável.',
  unauthorized: 'Entre na sua conta para continuar.',
  forbidden: 'Esta operação está reservada à administração.',
  unavailable: 'Não foi possível concluir. Tente novamente mais tarde.',
  invalid_credentials: 'Nome de utilizador ou palavra-passe incorrectos.',
  invalid_recovery: 'Não foi possível recuperar a conta. Confirme o nome de utilizador e o código.',
  activation_busy: 'A activação está em curso. Aguarde um momento e tente novamente.',
  already_used: 'Este convite já foi utilizado. O cancelamento de convites não suspende contas activas.',
};

function response(body: unknown, status = 200, extra: Record<string,string> = {}) {
  return Response.json(body, { status, headers: { ...headers, ...extra } });
}
function fail(code: string, status = 400, retryAfter?: number) {
  return response({ ok: false, error: { code, message: message[code] || message.unavailable },
    ...(retryAfter ? { retry_after: retryAfter } : {}) }, status,
  retryAfter ? { 'Retry-After': String(retryAfter) } : {});
}
function resultFailure(result: Result): Response {
  const code = text(result.error?.code) || 'unavailable';
  return fail(code, code === 'rate_limited' ? 429 : code === 'forbidden' ? 403 : code === 'unauthorized' ? 401 : 400,
    code === 'rate_limited' ? 60 : undefined);
}
export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && Array.from(value).length >= 12 && new TextEncoder().encode(value).length <= 72
    && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value);
}
export async function sha256(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map(n => n.toString(16).padStart(2,'0')).join('');
}
export function randomSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n => n.toString(16).padStart(2,'0')).join('');
}
export async function otpDigest(pepper: string, tokenHash: string, challenge: string, otp: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`trusted-invitation-otp-v1:${tokenHash}:${challenge}:${otp}`))))
    .map(n => n.toString(16).padStart(2,'0')).join('');
}
function randomOtp(): string {
  let value: number;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= 4294000000);
  return (value % 1000000).toString().padStart(6, '0');
}
function signedSessionId(jwt: string): string | null {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return uuidPattern.test(payload.session_id) ? payload.session_id : null;
  } catch { return null; }
}

export function createHandler(ports: Ports) {
  async function rate(category: string, subject: string, limit: number, window: number): Promise<boolean> {
    const key = await sha256(`${ports.ratePepper}:trusted-invitations-v1:${category}:${subject}`);
    return (await ports.rpc('rate', { key, limit, window_seconds: window })).ok === true;
  }
  return async function handler(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return response({});
    if (request.method !== 'POST') return fail('invalid_request', 405);
    try {
      const raw = await request.text();
      if (raw.length > 8192) return fail('invalid_request', 413);
      let input: Record<string, unknown>;
      try { input = JSON.parse(raw); } catch { return fail('invalid_request'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('invalid_request');
      const action = text(input.action);
      const forwarded = request.headers.get('x-forwarded-for')?.split(',');
      const ip = request.headers.get('x-real-ip') || forwarded?.at(-1)?.trim() || 'unknown';
      if (!await rate('ip', ip, 120, 60)) return fail('rate_limited', 429, 60);

      if (['status','issue','list','revoke'].includes(action)) {
        const jwt = request.headers.get('authorization')?.replace(/^Bearer /i,'') || '';
        const user = jwt ? await ports.getUser(jwt) : null;
        const sessionId = user && !user.is_anonymous ? signedSessionId(jwt) : null;
        if (!user || user.is_anonymous || !sessionId) return fail('unauthorized', 401);
        const context = { session_id: sessionId };
        const status = await ports.rpc('status', context, user.id);
        if (!status.ok) return resultFailure(status);
        if (action === 'status') return response({ ok:true, sms_ready:ports.smsReady });
        if (action === 'list') {
          const result = await ports.rpc('list', context, user.id);
          return result.ok ? response(result) : resultFailure(result);
        }
        if (action === 'revoke') {
          if (!uuidPattern.test(text(input.id))) return fail('invalid_request');
          const result = await ports.rpc('revoke', { ...context, id:input.id }, user.id);
          return result.ok ? response(result) : resultFailure(result);
        }
        if (!await rate('issue', user.id, 30, 3600)) return fail('rate_limited', 429, 3600);
        const mode = text(input.mode), name = text(input.recipient_name).trim();
        const language = text(input.language) || 'pt';
        const ttl = input.expires_hours === undefined ? 72 : input.expires_hours;
        const phone = text(input.phone).trim();
        if (!['direct','phone'].includes(mode) || name.length < 2 || name.length > 100 || !languages.has(language)
          || typeof ttl !== 'number' || !Number.isInteger(ttl) || ttl < 1 || ttl > 168
          || (mode === 'phone' && !/^\+[1-9]\d{7,14}$/.test(phone))) return fail('invalid_request');
        if (mode === 'phone' && !ports.smsReady) return fail('sms_unavailable', 503);
        const token = randomSecret();
        const result = await ports.rpc('issue', { ...context, token_hash:await sha256(token), recipient_name:name,
          mode, phone:mode==='phone'?phone:null, language, expires_hours:ttl }, user.id);
        if (!result.ok) return resultFailure(result);
        return response({ ...result, token, link:`https://www.yamilook.com/register?lang=${language}#trusted=${token}` });
      }

      if (action === 'login' || action === 'recover') {
        const username = text(input.username).trim().replace(/^@/,'').toLowerCase();
        const invalidCode = action === 'login' ? 'invalid_credentials' : 'invalid_recovery';
        if (!usernamePattern.test(username)) return fail(invalidCode, 400);
        if (!await rate(`${action}-ip`, ip, action==='login'?30:20, 3600)
          || !await rate(`${action}-account`, username, action==='login'?10:5, 900)) return fail('rate_limited', 429, 900);
        if (action === 'login') {
          if (!text(input.password) || text(input.password).length > 256) return fail('invalid_credentials',401);
          const lookup = await ports.rpc('login_lookup', { username });
          // Always ask Auth to validate a password, including unknown names. The
          // dummy alias is deliberately different from all real internal IDs.
          const identifier = lookup.ok && lookup.identifier ? lookup.identifier : 'unknown@trusted-login.yamilook.invalid';
          const session = await ports.signIn(identifier, text(input.password));
          if (!lookup.user_id || !session || session.user?.id !== lookup.user_id) {
            await ports.rpc('login_audit',{user_id:lookup.user_id||null,success:false});
            return fail('invalid_credentials',401);
          }
          await ports.rpc('login_audit',{user_id:lookup.user_id,success:true});
          return response({ ok:true, session });
        }
        const code = text(input.recovery_code).replace(/[\s-]/g,'').toLowerCase();
        if (!tokenPattern.test(code)) return fail('invalid_recovery');
        if (!validPassword(input.new_password)) return fail('weak_password');
        const nextCode = randomSecret();
        const result = await ports.rpc('recover', { username, recovery_hash:await sha256(code),
          next_recovery_hash:await sha256(nextCode), password_hash:await ports.hashPassword(input.new_password) });
        if (!result.ok) return resultFailure(result);
        return response({ ok:true, username, recovery_code:nextCode });
      }

      if (!['preview','request_otp','activate'].includes(action)) return fail('invalid_request');
      const token = text(input.token).trim().toLowerCase();
      if (!tokenPattern.test(token)) return fail('invalid_invitation');
      const tokenHash = await sha256(token);
      if (!await rate(`${action}-token`, tokenHash, action==='preview'?40:action==='request_otp'?5:10,
        action==='request_otp'?3600:600)) return fail('rate_limited',429,action==='request_otp'?3600:600);
      if (action === 'preview') {
        const result = await ports.rpc('preview', { token_hash:tokenHash });
        return result.ok ? response(result) : resultFailure(result);
      }
      if (action === 'request_otp') {
        if (!ports.smsReady) return fail('sms_unavailable',503);
        const challengeId = crypto.randomUUID(), otp = randomOtp();
        const result = await ports.rpc('request_otp', { token_hash:tokenHash, otp_id:challengeId,
          otp_hash:await otpDigest(ports.otpPepper,tokenHash,challengeId,otp) });
        if (!result.ok) return resultFailure(result);
        let accepted = false;
        try { accepted = await ports.sendSms(result.phone,otp,result.language||'pt'); } catch { accepted = false; }
        const delivery = await ports.rpc('otp_delivery', { token_hash:tokenHash, otp_id:challengeId,accepted });
        if (!accepted || !delivery.ok) return fail('delivery_failed',502);
        return response({ok:true,retry_after:60,expires_in:300});
      }

      const username = text(input.username).trim().replace(/^@/,'').toLowerCase();
      const displayName = text(input.display_name).trim();
      if (!usernamePattern.test(username)) return fail('invalid_username');
      if (displayName.length < 2 || displayName.length > 100) return fail('invalid_request');
      if (!validPassword(input.password)) return fail('weak_password');
      if (input.accepted_terms !== true) return fail('terms_required');
      const context = await ports.rpc('activation_context', { token_hash:tokenHash });
      if (!context.ok) return resultFailure(context);
      let digest: string | null = null;
      if (context.mode === 'phone') {
        if (!ports.smsReady) return fail('sms_unavailable',503);
        if (!/^\d{6}$/.test(text(input.otp)) || !context.otp_id) return fail('invalid_otp');
        digest = await otpDigest(ports.otpPepper,tokenHash,context.otp_id,text(input.otp));
      }
      const claimHash = await sha256(randomSecret());
      const prepared = await ports.rpc('prepare_activation', { token_hash:tokenHash, username,
        claim_hash:claimHash, otp_id:context.otp_id || null, otp_hash:digest });
      if (!prepared.ok) return resultFailure(prepared);
      const identifier = `${crypto.randomUUID().replace(/-/g,'')}@trusted-login.yamilook.invalid`;
      const recoveryCode = randomSecret(), recoveryHash = await sha256(recoveryCode);
      let created: {id:string}|null = null;
      try {
        created = await ports.createUser({ email:identifier, password:input.password, email_confirm:true,
          ...(prepared.mode==='phone' ? {phone:prepared.phone,phone_confirm:true} : {}),
          user_metadata:{username,display_name:displayName,terms_accepted_at:new Date().toISOString()},
          app_metadata:{trusted_signup_version:1,trusted_claim_hash:claimHash,trusted_recovery_hash:recoveryHash} });
      } catch { /* Reconcile a possible committed Auth request before retrying. */ }
      if (!created) {
        const committed = await ports.rpc('activation_result', { claim_hash:claimHash,recovery_hash:recoveryHash,identifier });
        if (committed.ok && committed.user_id) created = {id:committed.user_id};
      }
      if (!created) {
        await ports.rpc('release_activation', {token_hash:tokenHash,claim_hash:claimHash});
        return fail('unavailable',503);
      }
      let session = null;
      try { session = await ports.signIn(identifier,input.password); } catch { /* Account remains usable with username and password. */ }
      if (session && session.user?.id !== created.id) session = null;
      return response({ok:true,account_created:true,username,recovery_code:recoveryCode,session});
    } catch { return fail('unavailable',503); }
  };
}
