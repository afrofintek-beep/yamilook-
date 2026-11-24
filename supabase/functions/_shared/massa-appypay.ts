/** AppyPay sandbox transport. No production endpoint or browser credentials. */
export type PaymentMethod = 'GPO' | 'REF';
export type AttemptState = 'submitting' | 'pending' | 'uncertain' | 'confirmed' | 'failed' | 'expired' | 'review';
export interface GatewayAttempt {
  id: string; request_id: string; order_id: string | null; purpose: 'order' | 'topup';
  actor_id: string; beneficiary_id: string; amount_minor: number; currency: 'AOA';
  method: PaymentMethod; phone: string | null; merchant: string; merchant_ref: string;
  provider_charge_id: string | null; state: AttemptState; provider_code: number | null;
  reference: string | null; entity: string | null; provider_due_at: string | null;
  issue_code: string | null; created_at: string; updated_at: string; observed_paid?: boolean;
  submit?: boolean;
}
export interface SandboxConfig {
  clientId: string; clientSecret: string; resource: string; merchant: string;
  gpoKey: string; refKey: string; allowedUsers: Set<string>; allowedOrigins: Set<string>;
  webhookMode: 'verify-by-query' | 'shared-token'; webhookToken: string;
  reconcileToken: string;
}
export type Env = (key: string) => string | undefined;
export const SANDBOX_GATEWAY = 'https://gwy-api-tst.appypay.co.ao';
export const SANDBOX_TOKEN = 'https://login.microsoftonline.com/appypaydev.onmicrosoft.com/oauth2/token';
export const SANDBOX_RESOURCE = '2aed7612-de64-46b5-9e59-1f48f8902d14';
const PRODUCTION_PROJECT = 'rfayqekonkovfbkwjjum';
export const MAX_MINOR = 100_000_000;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isMerchantRef = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9]{1,15}$/.test(value);
const split = (value?: string) => (value ?? '').split(',').map(s => s.trim()).filter(Boolean);

export function allowedOrigins(env: Env): Set<string> {
  return new Set(split(env('MASSA_APPYPAY_ALLOWED_ORIGINS') ?? 'https://yamilook.com,https://www.yamilook.com').filter(value => {
    try { const u = new URL(value); return u.origin === value && u.protocol === 'https:'; } catch { return false; }
  }));
}

/** Explicit opt-in, isolated Supabase project, and merchant-scoped sandbox keys. */
export function loadSandboxConfig(env: Env): SandboxConfig | null {
  if (env('MASSA_APPYPAY_ENABLED') !== 'sandbox') return null;
  const ref = env('MASSA_APPYPAY_SANDBOX_PROJECT_REF');
  if (!ref || ref === PRODUCTION_PROJECT || !/^[a-z]{20}$/.test(ref)) return null;
  try {
    const url = new URL(env('SUPABASE_URL') ?? '');
    if (url.origin !== `https://${ref}.supabase.co` || url.pathname !== '/' || url.username || url.password || url.search || url.hash) return null;
  } catch { return null; }
  const clientId = env('MASSA_APPYPAY_CLIENT_ID') ?? '';
  const clientSecret = env('MASSA_APPYPAY_CLIENT_SECRET') ?? '';
  const resource = env('MASSA_APPYPAY_RESOURCE') ?? '';
  const merchant = env('MASSA_APPYPAY_MERCHANT_ID') ?? '';
  const gpoKey = env('MASSA_APPYPAY_GPO_KEY') ?? '';
  const refKey = env('MASSA_APPYPAY_REF_KEY') ?? '';
  const users = split(env('MASSA_APPYPAY_ALLOWED_USERS'));
  const reconcileToken = env('MASSA_APPYPAY_RECONCILE_TOKEN') ?? '';
  const webhookMode = env('MASSA_APPYPAY_WEBHOOK_MODE') ?? 'verify-by-query';
  const webhookToken = env('MASSA_APPYPAY_WEBHOOK_TOKEN') ?? '';
  if (!isUuid(clientId) || resource !== SANDBOX_RESOURCE || !clientSecret || clientSecret.length > 4096 ||
      !/^[a-zA-Z0-9:_-]{1,80}$/.test(merchant) || !/^GPO_/i.test(gpoKey) || !isUuid(gpoKey.slice(4)) ||
      !/^REF_/i.test(refKey) || !isUuid(refKey.slice(4)) || !users.length || !users.every(isUuid) ||
      reconcileToken.length < 32 || !['verify-by-query', 'shared-token'].includes(webhookMode) ||
      (webhookMode === 'shared-token' && webhookToken.length < 32)) return null;
  return { clientId, clientSecret, resource, merchant, gpoKey, refKey, allowedUsers: new Set(users),
    allowedOrigins: allowedOrigins(env), reconcileToken, webhookToken, webhookMode: webhookMode as SandboxConfig['webhookMode'] };
}

export class GatewayError extends Error {
  readonly code: string;
  readonly uncertain: boolean;
  constructor(code: string, uncertain = false) { super(code); this.name = 'GatewayError'; this.code = code; this.uncertain = uncertain; }
}

export function amountFromMinor(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_MINOR) throw new GatewayError('invalid_amount');
  return Number(`${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`);
}

/** Reject excess precision rather than rounding a provider's financial evidence. */
export function minorFromAmount(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string') throw new GatewayError('invalid_amount');
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new GatewayError('invalid_amount');
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (minor < 1n || minor > BigInt(MAX_MINOR)) throw new GatewayError('invalid_amount');
  return Number(minor);
}

export const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export interface Charge {
  id: string | null; merchantRef: string | null; amountMinor: number | null; currency: string | null;
  method: string | null; state: 'pending' | 'confirmed' | 'failed' | 'expired' | 'review'; code: number | null;
  reference: string | null; entity: string | null; dueAt: string | null;
}
const shortString = (v: unknown, length = 120): string | null => typeof v === 'string' && v.length > 0 && v.length <= length ? v : null;

function latestChargeStatus(payment: Record<string, unknown>): Record<string, unknown> {
  if (payment.type !== 'Charge' || payment.operation !== 'ONE_TIME_PAYMENT' || !Array.isArray(payment.transactionEvents)) return {};
  let latestId = 0;
  let responseStatus: Record<string, unknown> = {};
  for (const value of payment.transactionEvents) {
    const event = object(value);
    if (event.type !== 'Charge' || event.transactionId !== payment.id ||
        typeof event.id !== 'number' || !Number.isSafeInteger(event.id) || event.id <= latestId) continue;
    latestId = event.id;
    responseStatus = object(event.responseStatus);
  }
  return responseStatus.source === payment.paymentMethod ? responseStatus : {};
}

export function normalizeCharge(value: unknown): Charge {
  const envelope = object(value);
  const isDetail = Object.hasOwn(envelope, 'payment');
  const data = isDetail ? object(envelope.payment) : envelope;
  const rs = isDetail ? latestChargeStatus(data) : object(data.responseStatus);
  const code = (typeof rs.code === 'number' || typeof rs.code === 'string') && /^\d{1,6}$/.test(String(rs.code)) ? Number(rs.code) : null;
  const status = String((isDetail ? data.status : rs.status) ?? '').toLowerCase();
  let state: Charge['state'] = 'review';
  if (code === 101 && (!isDetail || (rs.successful === true && status === 'pending'))) state = 'pending';
  else if (code === 100 && rs.successful === true && status === 'success') state = 'confirmed';
  else if (code !== null && code !== 100 && rs.successful === false) {
    if (['failed', 'failure', 'rejected', 'declined', 'cancelled', 'canceled'].includes(status)) state = 'failed';
    else if (status === 'expired') state = 'expired';
  }
  const reference = object(rs.reference ?? data.reference);
  let amountMinor: number | null = null;
  try { amountMinor = minorFromAmount(data.amount); } catch { /* Missing/invalid money never confirms a payment. */ }
  const rawDue = shortString(reference.dueDate, 50);
  const dueAt = rawDue && /(?:Z|[+-]\d{2}:\d{2})$/.test(rawDue) && Number.isFinite(Date.parse(rawDue)) ? new Date(rawDue).toISOString() : null;
  return { id: isUuid(data.id) ? data.id : null, merchantRef: isMerchantRef(data.merchantTransactionId) ? data.merchantTransactionId : null,
    amountMinor, currency: shortString(data.currency, 3), method: shortString(isDetail ? data.paymentMethod : rs.source, 12), state, code,
    reference: shortString(reference.referenceNumber, 30), entity: shortString(reference.entity, 15), dueAt };
}

export function verifyCharge(charge: Charge, attempt: GatewayAttempt, chargeId: string, merchant: string): void {
  if (!isUuid(chargeId) || charge.id !== chargeId || (attempt.provider_charge_id && attempt.provider_charge_id !== chargeId) ||
      attempt.merchant !== merchant || charge.merchantRef !== attempt.merchant_ref || charge.amountMinor !== attempt.amount_minor ||
      charge.currency !== 'AOA' || charge.method !== attempt.method) throw new GatewayError('charge_mismatch');
}

/** Limited bodies and redirect rejection avoid credential leakage to redirects. */
export async function readJsonBody(input: Request | Response, limit = 65_536): Promise<Record<string, unknown>> {
  const reader = input.body?.getReader();
  if (!reader) throw new GatewayError('invalid_json');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new GatewayError('body_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const value = JSON.parse(new TextDecoder().decode(joined));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
    return value;
  } catch { throw new GatewayError('invalid_json'); }
}

export class SandboxAppyPay {
  private cached: { token: string; until: number } | null = null;
  private obtaining: Promise<string> | null = null;
  private config: SandboxConfig;
  private fetcher: typeof fetch;
  private clock: () => number;
  constructor(config: SandboxConfig, fetcher: typeof fetch = fetch, clock: () => number = Date.now) {
    this.config = config; this.fetcher = fetcher; this.clock = clock;
  }

  private async token(): Promise<string> {
    if (this.cached && this.clock() < this.cached.until) return this.cached.token;
    if (this.obtaining) return await this.obtaining;
    this.obtaining = (async () => {
      let response: Response;
      try {
        response = await this.fetcher(SANDBOX_TOKEN, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.config.clientId,
            client_secret: this.config.clientSecret, resource: this.config.resource }) });
      } catch { throw new GatewayError('authentication_unavailable'); }
      if (!response.ok) throw new GatewayError('authentication_rejected');
      const data = await readJsonBody(response);
      const seconds = Number(data.expires_in);
      if (typeof data.access_token !== 'string' || !data.access_token || String(data.token_type).toLowerCase() !== 'bearer' ||
          !Number.isFinite(seconds) || seconds < 60 || seconds > 86400) throw new GatewayError('authentication_invalid');
      this.cached = { token: data.access_token, until: this.clock() + (seconds - 30) * 1000 };
      return this.cached.token;
    })();
    try { return await this.obtaining; } finally { this.obtaining = null; }
  }

  async create(attempt: GatewayAttempt): Promise<Charge> {
    if (attempt.merchant !== this.config.merchant || attempt.currency !== 'AOA' || !isUuid(attempt.id) || !isUuid(attempt.request_id) ||
        !isMerchantRef(attempt.merchant_ref) || !['GPO', 'REF'].includes(attempt.method)) throw new GatewayError('invalid_attempt');
    const amount = amountFromMinor(attempt.amount_minor);
    if (attempt.method === 'GPO' && !/^90000000[0-3]$/.test(attempt.phone ?? '')) throw new GatewayError('invalid_test_phone');
    const token = await this.token(); // OAuth errors precede the financial POST.
    const body: Record<string, unknown> = { amount, currency: 'AOA', description: 'MASSA sandbox',
      merchantTransactionId: attempt.merchant_ref, paymentMethod: attempt.method === 'GPO' ? this.config.gpoKey : this.config.refKey };
    if (attempt.method === 'GPO') body.paymentInfo = { phoneNumber: attempt.phone };
    // REF automatic generation follows the merchant's provisioned July 16 example.
    // No guessed reference/date options are sent when their contract is unknown.
    let response: Response;
    try {
      response = await this.fetcher(`${SANDBOX_GATEWAY}/v2.0/charges`, { method: 'POST', redirect: 'error',
        signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body) });
    } catch { throw new GatewayError('creation_uncertain', true); }
    if (!response.ok) {
      if ([400, 401, 403, 422].includes(response.status)) throw new GatewayError('creation_rejected');
      throw new GatewayError(response.status === 409 ? 'reference_conflict' : 'creation_uncertain', true);
    }
    try { return normalizeCharge(await readJsonBody(response)); }
    catch { throw new GatewayError('creation_uncertain', true); }
  }

  async get(chargeId: string): Promise<Charge> {
    if (!isUuid(chargeId)) throw new GatewayError('invalid_charge_id');
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.token();
      let response: Response;
      try {
        response = await this.fetcher(`${SANDBOX_GATEWAY}/v2.0/charges/${chargeId}`, { method: 'GET', redirect: 'error',
          signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      } catch { throw new GatewayError('query_unavailable'); }
      if (response.status === 401 && attempt === 0) { this.cached = null; continue; }
      if (!response.ok) throw new GatewayError('query_unavailable');
      return normalizeCharge(await readJsonBody(response));
    }
    throw new GatewayError('query_unavailable');
  }
}

export async function equalSecret(provided: string, expected: string): Promise<boolean> {
  if (!expected || !provided || provided.length > 4096) return false;
  const digest = async (v: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(provided), digest(expected)]);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]; return diff === 0;
}
export async function hashEvent(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}

/** Explicit projection: no phone, merchant keys, OAuth fields or raw PSP body. */
export function publicAttempt(attempt: GatewayAttempt | null) {
  if (!attempt) return null;
  return { id: attempt.id, request_id: attempt.request_id, order_id: attempt.order_id, purpose: attempt.purpose,
    amount_minor: attempt.amount_minor, currency: attempt.currency, method: attempt.method, state: attempt.state,
    provider_charge_id: attempt.provider_charge_id, reference: attempt.reference, entity: attempt.entity,
    provider_due_at: attempt.provider_due_at, issue_code: attempt.issue_code, created_at: attempt.created_at, updated_at: attempt.updated_at };
}
